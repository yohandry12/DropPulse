import { prisma } from "../prisma.js";
import { notify } from "../notifications/service.js";

const HOUR_MS = 60 * 60 * 1000;

// Slice 2 — DROP_OPEN. Notify subscribers of drops that have just opened. A
// pending alert (notifiedAt null) on a product whose dropAt has passed fires
// once, then notifiedAt is stamped so it never fires again. Only published,
// non-archived, non-paused drops count as "open". Returns notifications sent.
export async function notifyOpenedDrops(now: Date = new Date()): Promise<number> {
  const pending = await prisma.dropAlert.findMany({
    where: {
      notifiedAt: null,
      product: {
        status: "SCHEDULED",
        dropAt: { not: null, lte: now },
        archivedAt: null,
        pausedAt: null,
      },
    },
    select: { id: true, userId: true, productId: true, product: { select: { name: true } } },
  });
  if (pending.length === 0) return 0;

  let sent = 0;
  for (const a of pending) {
    await notify({
      userId: a.userId,
      type: "DROP_OPEN",
      title: "Le drop est ouvert",
      body: `${a.product.name} est maintenant en live. Réserve ton exemplaire avant qu'il parte.`,
      productId: a.productId,
      email: true,
    });
    await prisma.dropAlert.update({
      where: { id: a.id },
      data: { notifiedAt: now },
    });
    sent++;
  }
  return sent;
}

// Slice 3 — DROP_SOON. Remind subscribers ~1h before opening. Fires for
// still-pending alerts whose product opens within the next hour (but hasn't
// opened yet — that's DROP_OPEN's job). We do NOT stamp notifiedAt here: that
// field marks the DROP_OPEN fire. To avoid re-reminding every tick, we guard
// against duplicates by checking no DROP_SOON notification already exists for
// this user+product. Returns reminders sent.
export async function notifySoonDrops(now: Date = new Date()): Promise<number> {
  const soonThreshold = new Date(now.getTime() + HOUR_MS);
  const pending = await prisma.dropAlert.findMany({
    where: {
      notifiedAt: null,
      product: {
        status: "SCHEDULED",
        dropAt: { not: null, gt: now, lte: soonThreshold },
        archivedAt: null,
        pausedAt: null,
      },
    },
    select: { userId: true, productId: true, product: { select: { name: true } } },
  });
  if (pending.length === 0) return 0;

  let sent = 0;
  for (const a of pending) {
    // Dedup: skip if this user already got a DROP_SOON for this product.
    const already = await prisma.notification.findFirst({
      where: { userId: a.userId, productId: a.productId, type: "DROP_SOON" },
      select: { id: true },
    });
    if (already) continue;
    await notify({
      userId: a.userId,
      type: "DROP_SOON",
      title: "Ton drop ouvre bientôt",
      body: `${a.product.name} ouvre dans moins d'une heure. Sois prêt.`,
      productId: a.productId,
    });
    sent++;
  }
  return sent;
}
