import { prisma } from "../prisma.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Auto-pause drops whose lifetime has elapsed. A drop with durationDays set that
// opened more than that many days ago AND still has unsold stock is hidden from
// the public by stamping pausedAt (reusing the SUSPENDU state — reversible, the
// creator can reactivate + edit). Sold-out drops are left alone (they read
// SOLD_OUT already); archived/paused drops are skipped. Returns the count paused.
export async function expireLiveDrops(now: Date = new Date()): Promise<number> {
  // Candidates: published, opened, with a lifetime, not already hidden.
  const candidates = await prisma.product.findMany({
    where: {
      status: "SCHEDULED",
      dropAt: { not: null, lte: now },
      durationDays: { not: null },
      archivedAt: null,
      pausedAt: null,
    },
    select: { id: true, dropAt: true, durationDays: true },
  });

  const expiredIds: string[] = [];
  for (const p of candidates) {
    if (!p.dropAt || p.durationDays == null) continue;
    const closesAt = p.dropAt.getTime() + p.durationDays * DAY_MS;
    if (closesAt > now.getTime()) continue; // still within its lifetime
    expiredIds.push(p.id);
  }
  if (expiredIds.length === 0) return 0;

  // Only pause those that still have unsold stock — a sold-out drop needs no
  // slot-freeing. Checked here so the filter stays in one place.
  const withStock = await prisma.productUnit.groupBy({
    by: ["productId"],
    where: { productId: { in: expiredIds }, status: { in: ["available", "held"] } },
    _count: { _all: true },
  });
  const toPause = withStock.map((g) => g.productId);
  if (toPause.length === 0) return 0;

  const { count } = await prisma.product.updateMany({
    where: { id: { in: toPause } },
    data: { pausedAt: now },
  });
  return count;
}
