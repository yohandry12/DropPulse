import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../auth/middleware.js";
import { prisma } from "../prisma.js";

export const notificationRouter = Router();

// Bell centre: a user's notifications, newest first, capped. Also returns the
// unread count so the header badge needs a single request.
notificationRouter.get("/notifications", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  res.json({
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      productId: n.productId,
      read: n.readAt !== null,
      createdAt: n.createdAt,
    })),
  });
});

// Mark one notification read. Scoped to the caller (updateMany with the userId
// guard) so a user can't flip another user's row.
notificationRouter.patch(
  "/notifications/:id/read",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const { count } = await prisma.notification.updateMany({
      where: { id: String(req.params.id), userId: req.user!.sub, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ updated: count });
  }
);

// Mark every unread notification read (the "tout marquer comme lu" action).
notificationRouter.post(
  "/notifications/read-all",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const { count } = await prisma.notification.updateMany({
      where: { userId: req.user!.sub, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ updated: count });
  }
);

// "M'alerter à l'ouverture": is the caller subscribed to this drop's opening?
// Drives the button's on/off state on the upcoming-drop page.
notificationRouter.get(
  "/products/:id/alert",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const alert = await prisma.dropAlert.findUnique({
      where: { userId_productId: { userId: req.user!.sub, productId: String(req.params.id) } },
    });
    res.json({ subscribed: alert !== null });
  }
);

// Subscribe to a drop's opening. Idempotent (upsert): re-subscribing is a no-op.
// Only meaningful for an upcoming, unopened drop — but we don't gate here; the
// worker only fires DROP_OPEN once dropAt is crossed, so a stale subscription
// on an already-open drop simply never fires.
notificationRouter.post(
  "/products/:id/alert",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const userId = req.user!.sub;
    const productId = String(req.params.id);
    await prisma.dropAlert.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {}, // already subscribed → nothing to change
    });
    res.json({ subscribed: true });
  }
);

// Unsubscribe. deleteMany (not delete) so removing a non-existent subscription
// is a harmless no-op rather than a 404.
notificationRouter.delete(
  "/products/:id/alert",
  requireAuth,
  async (req: AuthedRequest, res) => {
    await prisma.dropAlert.deleteMany({
      where: { userId: req.user!.sub, productId: String(req.params.id) },
    });
    res.json({ subscribed: false });
  }
);
