import type { Prisma, ProductUnit, UnitStatus } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../prisma.js";
import { assertTransition } from "./stateMachine.js";

export class ConflictError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "ConflictError";
  }
}

// Lock a single ProductUnit row FOR UPDATE inside the transaction, then return
// the typed (camelCase) row via Prisma. The raw query is only for the lock;
// $queryRaw returns snake_case columns, so we re-fetch through the client.
async function lockUnit(
  tx: Prisma.TransactionClient,
  unitId: string
): Promise<ProductUnit | null> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM product_units WHERE id = ${unitId} FOR UPDATE
  `;
  if (locked.length === 0) return null;
  return tx.productUnit.findUnique({ where: { id: unitId } });
}

// Reserve a unit: available -> held. One active hold per user enforced by the
// partial unique index; we surface a clean error if the user already holds one.
export async function holdUnit(
  unitId: string,
  userId: string
): Promise<ProductUnit> {
  return prisma.$transaction(async (tx) => {
    const unit = await lockUnit(tx, unitId);
    if (!unit) throw new ConflictError("unit_not_found");

    if (unit.status !== "available") {
      // Row is locked; whoever holds/sold it won the race.
      throw new ConflictError("unit_unavailable");
    }

    // Per-drop config: hold TTL and the max a single buyer may take. Falls back
    // to the global env TTL only if the product row is somehow missing (it never
    // should be — FK guarantees it).
    const product = await tx.product.findUnique({
      where: { id: unit.productId },
      select: { holdMinutes: true, maxPerBuyer: true, archivedAt: true, pausedAt: true },
    });
    // Archived or paused drop: no new holds — the drop isn't publicly available.
    if (product?.archivedAt) {
      throw new ConflictError("product_archived");
    }
    if (product?.pausedAt) {
      throw new ConflictError("product_paused");
    }
    const holdMinutes = product?.holdMinutes ?? config.holdTtlMinutes;
    const maxPerBuyer = product?.maxPerBuyer ?? 1;

    // Enforce the per-drop buyer cap: count units of THIS drop already held or
    // sold by this user. Runs inside the txn so it sees committed+locked state.
    const takenByUser = await tx.productUnit.count({
      where: {
        productId: unit.productId,
        heldByUserId: userId,
        status: { in: ["held", "sold"] },
      },
    });
    if (takenByUser >= maxPerBuyer) {
      throw new ConflictError("max_per_buyer_reached");
    }

    assertTransition(unit.status, "held" as UnitStatus);

    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
    try {
      return await tx.productUnit.update({
        where: { id: unitId },
        data: {
          status: "held",
          heldByUserId: userId,
          heldAt: new Date(),
          expiresAt,
        },
      });
    } catch (e) {
      // Partial unique index violation = user already has an active hold.
      if (
        typeof e === "object" &&
        e !== null &&
        (e as { code?: string }).code === "P2002"
      ) {
        throw new ConflictError("user_already_holding");
      }
      throw e;
    }
  });
}

// Release a hold early (user gave up): held -> available. Only the holder may
// release, and only while it is still their live hold.
export async function releaseHold(
  unitId: string,
  userId: string
): Promise<ProductUnit> {
  return prisma.$transaction(async (tx) => {
    const unit = await lockUnit(tx, unitId);
    if (!unit) throw new ConflictError("unit_not_found");

    if (unit.status !== "held" || unit.heldByUserId !== userId) {
      throw new ConflictError("not_your_hold");
    }

    return tx.productUnit.update({
      where: { id: unitId },
      data: { status: "available", heldByUserId: null, heldAt: null, expiresAt: null },
    });
  });
}

// Confirm payment (simulated): held -> sold.
// Re-checks expires_at > now() INSIDE the txn — a hold expired but not yet
// released by the cron must NOT be payable.
export async function confirmPayment(
  unitId: string,
  userId: string
): Promise<ProductUnit> {
  return prisma.$transaction(async (tx) => {
    const unit = await lockUnit(tx, unitId);
    if (!unit) throw new ConflictError("unit_not_found");

    if (unit.status !== "held" || unit.heldByUserId !== userId) {
      throw new ConflictError("not_your_hold");
    }

    if (!unit.expiresAt || unit.expiresAt <= new Date()) {
      throw new ConflictError("hold_expired");
    }

    assertTransition(unit.status, "sold" as UnitStatus);

    return tx.productUnit.update({
      where: { id: unitId },
      data: { status: "sold", soldAt: new Date() },
    });
  });
}
