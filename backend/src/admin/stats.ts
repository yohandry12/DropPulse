import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { deriveDropStatus } from "./dropStatus.js";

// A1 — admin dashboard counters. One GET returns every headline number the
// dashboard shows: user totals by role, active-drop breakdown (live/scheduled),
// and the pending dropper-request count. Live/scheduled are DERIVED (dropAt +
// counts + pause), mirroring the drops table, so a paused or sold-out drop never
// counts as live. Archived drops are excluded everywhere.

export const adminStatsRouter = Router();

adminStatsRouter.get(
  "/admin/stats",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res) => {
    // Users by role in one grouped pass.
    const roleGroups = await prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
    });
    const byRole = new Map(roleGroups.map((g) => [g.role, g._count._all]));
    const users = {
      total: roleGroups.reduce((s, g) => s + g._count._all, 0),
      chasers: byRole.get("CHASER") ?? 0,
      droppers: byRole.get("DROPPER") ?? 0,
      admins: byRole.get("ADMIN") ?? 0,
    };

    // Active (non-archived) drops + their sold counts, to derive live/scheduled.
    const products = await prisma.product.findMany({
      where: { archivedAt: null },
      select: { id: true, status: true, dropAt: true, pausedAt: true, _count: { select: { units: true } } },
    });
    const soldGroups = await prisma.productUnit.groupBy({
      by: ["productId"],
      where: { status: "sold" },
      _count: { _all: true },
    });
    const soldByProduct = new Map(soldGroups.map((g) => [g.productId, g._count._all]));

    let live = 0;
    let scheduled = 0;
    for (const p of products) {
      const status = deriveDropStatus({
        status: p.status,
        dropAt: p.dropAt,
        pausedAt: p.pausedAt,
        soldCount: soldByProduct.get(p.id) ?? 0,
        unitCount: p._count.units,
      });
      if (status === "LIVE") live++;
      else if (status === "SCHEDULED") scheduled++;
    }

    const pendingRequests = await prisma.dropperRequest.count({
      where: { status: "PENDING" },
    });

    res.json({
      users,
      drops: { active: live + scheduled, live, scheduled },
      pendingRequests,
    });
  },
);
