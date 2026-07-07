import express, { Router } from "express";
import { requireAuth, requireRole, type AuthedRequest } from "../auth/middleware.js";
import { prisma } from "../prisma.js";
import { log } from "../logger.js";
import { getStripe, stripeWebhookSecret } from "./stripe.js";
import { fulfillPaidUnit } from "./service.js";
import {
  createDashboardLink,
  createOnboardingLink,
  getPayoutStatus,
  refreshPayoutStatus,
} from "./connect.js";
import { mailConfig } from "../config.js";

export const paymentRouter = Router();

// --- Stripe Connect (dropper payouts) — DROPPER/ADMIN only. ---

// Current payout status (cheap DB read) — drives the settings page + the
// dropdown "urgent" badge.
paymentRouter.get(
  "/payouts/status",
  requireAuth,
  requireRole("DROPPER"),
  async (req: AuthedRequest, res) => {
    res.json(await getPayoutStatus(req.user!.sub));
  }
);

// Re-sync charges_enabled from Stripe (called when returning from onboarding).
paymentRouter.post(
  "/payouts/refresh",
  requireAuth,
  requireRole("DROPPER"),
  async (req: AuthedRequest, res) => {
    try {
      res.json(await refreshPayoutStatus(req.user!.sub));
    } catch (e) {
      log.error("Payout status refresh failed", e instanceof Error ? e.message : String(e));
      res.status(502).json({ error: "refresh_failed" });
    }
  }
);

// Start (or resume) Stripe Connect onboarding — returns a hosted link URL.
paymentRouter.post(
  "/payouts/onboard",
  requireAuth,
  requireRole("DROPPER"),
  async (req: AuthedRequest, res) => {
    try {
      const url = await createOnboardingLink(req.user!.sub);
      if (!url) {
        res.status(503).json({ error: "payments_not_configured" });
        return;
      }
      res.json({ url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error("Onboarding link create failed", msg);
      // Distinguish "Connect not enabled on the platform" (a dashboard action
      // the operator must take) from a genuine Stripe outage — the frontend
      // shows different guidance for each.
      if (msg.includes("signed up for Connect")) {
        res.status(503).json({ error: "connect_not_enabled" });
        return;
      }
      res.status(502).json({ error: "onboarding_failed" });
    }
  }
);

// Open the Stripe Express dashboard (manage bank account / details / payouts).
// Only valid once onboarded — null means no connected account yet.
paymentRouter.post(
  "/payouts/dashboard",
  requireAuth,
  requireRole("DROPPER"),
  async (req: AuthedRequest, res) => {
    try {
      const url = await createDashboardLink(req.user!.sub);
      if (!url) {
        res.status(409).json({ error: "no_account" });
        return;
      }
      res.json({ url });
    } catch (e) {
      log.error("Dashboard link create failed", e instanceof Error ? e.message : String(e));
      res.status(502).json({ error: "dashboard_failed" });
    }
  }
);

// Start Stripe Checkout for a unit the caller currently holds. Creates a PENDING
// Order and a Checkout Session, returns the hosted-page URL for the frontend to
// redirect to. Guards: the unit must be held by this user (can't pay for
// someone else's / an available unit). One PENDING order per unit is enough —
// re-checkout reuses/replaces via upsert on the unique unitId.
paymentRouter.post(
  "/checkout/:unitId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "payments_not_configured" });
      return;
    }
    const userId = req.user!.sub;
    const unitId = String(req.params.unitId);

    const unit = await prisma.productUnit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        status: true,
        heldByUserId: true,
        expiresAt: true,
        serialNumber: true,
        productId: true,
        product: { select: { name: true, price: true } },
      },
    });
    if (!unit) {
      res.status(404).json({ error: "unit_not_found" });
      return;
    }
    if (unit.status !== "held" || unit.heldByUserId !== userId) {
      res.status(409).json({ error: "not_your_hold" });
      return;
    }
    if (!unit.expiresAt || unit.expiresAt <= new Date()) {
      res.status(409).json({ error: "hold_expired" });
      return;
    }

    const serial = `#${unit.serialNumber.split("-").pop()}`;

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: unit.product.price, // already in cents
              product_data: {
                name: `${unit.product.name} ${serial}`,
              },
            },
          },
        ],
        // metadata lets the webhook map the session back to the unit+buyer
        // without a DB lookup on the session id alone.
        metadata: { unitId: unit.id, userId },
        success_url: `${mailConfig.appUrl}/purchases?paid=1`,
        cancel_url: `${mailConfig.appUrl}/hold?canceled=1`,
      });

      // Snapshot the price now (a later drop edit must not rewrite history).
      await prisma.order.upsert({
        where: { unitId: unit.id },
        create: {
          userId,
          productId: unit.productId,
          unitId: unit.id,
          amountCents: unit.product.price,
          status: "PENDING",
          stripeSessionId: session.id,
        },
        update: {
          // Re-checkout on the same held unit: refresh the session, stay PENDING.
          stripeSessionId: session.id,
          status: "PENDING",
          amountCents: unit.product.price,
        },
      });

      res.json({ url: session.url });
    } catch (e) {
      log.error("Stripe checkout create failed", e instanceof Error ? e.message : String(e));
      res.status(502).json({ error: "checkout_failed" });
    }
  }
);

// Stripe webhook. Mounted with express.raw() (Stripe signs the RAW body — a
// JSON-parsed body fails signature verification). On checkout.session.completed
// we fulfil the unit (held→sold + notif) and mark the Order PAID. Idempotent:
// Stripe may retry, so a second completed event for an already-sold unit is a
// harmless no-op (confirmPayment throws on a non-held unit, which we swallow).
paymentRouter.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const stripe = getStripe();
    const secret = stripeWebhookSecret();
    if (!stripe || !secret) {
      res.status(503).json({ error: "payments_not_configured" });
      return;
    }

    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig as string, secret);
    } catch (e) {
      log.error("Stripe webhook signature check failed", e instanceof Error ? e.message : String(e));
      res.status(400).json({ error: "bad_signature" });
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        id: string;
        metadata?: { unitId?: string; userId?: string } | null;
      };
      const unitId = session.metadata?.unitId;
      const userId = session.metadata?.userId;
      if (unitId && userId) {
        try {
          await fulfillPaidUnit(unitId, userId);
          await prisma.order.updateMany({
            where: { unitId, status: "PENDING" },
            data: { status: "PAID", paidAt: new Date() },
          });
          log.ok(`Stripe payment fulfilled for unit ${unitId}`);
        } catch (e) {
          // Already-sold / released unit: log and still 200 so Stripe stops
          // retrying (the state is terminal from our side).
          log.warn("Stripe fulfilment skipped", e instanceof Error ? e.message : String(e));
        }
      }
    }

    // Always 200 on a validly-signed event so Stripe considers it delivered.
    res.json({ received: true });
  }
);
