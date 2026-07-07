import { prisma } from "../prisma.js";

// Release holds whose TTL has passed: held -> available.
// Single bulk UPDATE, atomic per row; WHERE guards status + expiry so a hold
// confirmed/sold in the same instant is never touched.
export async function releaseExpiredHolds(): Promise<number> {
  const { count } = await prisma.productUnit.updateMany({
    where: { status: "held", expiresAt: { lte: new Date() } },
    data: {
      status: "available",
      heldByUserId: null,
      heldAt: null,
      expiresAt: null,
    },
  });
  return count;
}
