import { prisma } from "../prisma.js";
import { notify } from "../notifications/service.js";

const WARN_WINDOW_MS = 2 * 60 * 1000; // warn when <2 min left

// Slice 3 — HOLD_EXPIRING. Warn a buyer their hold is about to be released so
// they finish paying. Fires for held units whose expiresAt is within the next
// 2 minutes (and still in the future — an already-expired hold is the worker's
// release job, not a warning).
//
// Dedup: there's no "warned" flag on the unit, so we guard against re-warning
// every tick by checking no HOLD_EXPIRING notification exists for this
// user+product since the hold was taken (heldAt). A fresh hold on the same drop
// (new heldAt) can warn again. Returns warnings sent.
export async function notifyExpiringHolds(now: Date = new Date()): Promise<number> {
  const soon = new Date(now.getTime() + WARN_WINDOW_MS);
  const holds = await prisma.productUnit.findMany({
    where: {
      status: "held",
      heldByUserId: { not: null },
      expiresAt: { gt: now, lte: soon },
    },
    select: {
      heldByUserId: true,
      heldAt: true,
      productId: true,
      serialNumber: true,
      product: { select: { name: true } },
    },
  });
  if (holds.length === 0) return 0;

  let sent = 0;
  for (const h of holds) {
    if (!h.heldByUserId) continue;
    // Dedup: already warned for this hold instance (since heldAt)?
    const already = await prisma.notification.findFirst({
      where: {
        userId: h.heldByUserId,
        productId: h.productId,
        type: "HOLD_EXPIRING",
        createdAt: h.heldAt ? { gte: h.heldAt } : undefined,
      },
      select: { id: true },
    });
    if (already) continue;
    const serial = `#${h.serialNumber.split("-").pop()}`;
    await notify({
      userId: h.heldByUserId,
      type: "HOLD_EXPIRING",
      title: "Ta réservation expire bientôt",
      body: `Il te reste moins de 2 min pour payer l'exemplaire ${serial} de ${h.product.name}.`,
      productId: h.productId,
    });
    sent++;
  }
  return sent;
}
