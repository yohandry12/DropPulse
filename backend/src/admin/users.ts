import { Router } from "express";
import type { Role, UserStatus } from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole, type AuthedRequest } from "../auth/middleware.js";

// A2 — user management (admin back-office). List every account with its role,
// status, join date and purchase count; toggle ACTIVE/DISABLED; change role;
// hard-delete. Self-targeting is refused (an admin can't lock or delete itself).
// See DESIGN_BRIEF_ADMIN.md (A2).

export const adminUsersRouter = Router();

const ROLES: Role[] = ["CHASER", "DROPPER", "ADMIN"];

// GET /admin/users — every account, newest first, with a sold-unit count.
// Purchase count = ProductUnit rows this user holds in `sold` state. Computed in
// one groupBy pass and merged in memory (back-office = few users, cheap).
adminUsersRouter.get("/admin/users", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
  });

  const sold = await prisma.productUnit.groupBy({
    by: ["heldByUserId"],
    where: { status: "sold", heldByUserId: { not: null } },
    _count: { _all: true },
  });
  const purchaseCount = new Map<string, number>();
  for (const row of sold) {
    if (row.heldByUserId) purchaseCount.set(row.heldByUserId, row._count._all);
  }

  res.json(
    users.map((u) => ({
      ...u,
      purchaseCount: purchaseCount.get(u.id) ?? 0,
    })),
  );
});

// PATCH /admin/users/:id/role — change a user's capability tier. An admin cannot
// change its own role (avoids self-demotion / last-admin lockout).
adminUsersRouter.patch(
  "/admin/users/:id/role",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const { role } = req.body ?? {};
    if (typeof role !== "string" || !ROLES.includes(role as Role)) {
      res.status(400).json({ error: "invalid_role" });
      return;
    }
    if (id === req.user!.sub) {
      res.status(400).json({ error: "cannot_modify_self" });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { role: role as Role },
      select: { id: true, role: true },
    });
    res.json(updated);
  },
);

// PATCH /admin/users/:id/status — enable / disable an account. A disabled
// account cannot log in (requireRole rejects it). An admin cannot disable itself.
adminUsersRouter.patch(
  "/admin/users/:id/status",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const { status } = req.body ?? {};
    if (status !== "ACTIVE" && status !== "DISABLED") {
      res.status(400).json({ error: "invalid_status" });
      return;
    }
    if (id === req.user!.sub) {
      res.status(400).json({ error: "cannot_modify_self" });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { status: status as UserStatus },
      select: { id: true, status: true },
    });
    res.json(updated);
  },
);

// DELETE /admin/users/:id — permanent hard-delete. Cascades to the user's
// dropper request and refresh tokens (schema onDelete: Cascade); their held
// units are released (onDelete: SetNull) and created drops orphaned (SetNull).
// Irreversible — the frontend double-confirms. An admin cannot delete itself.
adminUsersRouter.delete(
  "/admin/users/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    if (id === req.user!.sub) {
      res.status(400).json({ error: "cannot_modify_self" });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  },
);

// POST /admin/users/bulk-delete — permanent hard-delete of several accounts at
// once. Body: { ids: string[] }. The caller's own id is always excluded (an
// admin can't delete itself). Same cascade as the single delete. Returns the
// count actually deleted, so a stale UI can reconcile. Missing ids are ignored
// (deleteMany matches what exists) rather than failing the whole batch.
adminUsersRouter.post(
  "/admin/users/bulk-delete",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthedRequest, res) => {
    const { ids } = req.body ?? {};
    if (!Array.isArray(ids) || ids.some((v) => typeof v !== "string")) {
      res.status(400).json({ error: "invalid_ids" });
      return;
    }
    // Drop self + dedupe.
    const targets = [...new Set(ids as string[])].filter((id) => id !== req.user!.sub);
    if (targets.length === 0) {
      res.status(400).json({ error: "no_targets" });
      return;
    }
    const result = await prisma.user.deleteMany({ where: { id: { in: targets } } });
    res.json({ deleted: result.count });
  },
);
