import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { verifyAccessToken, type AccessPayload } from "./tokens.js";

export interface AuthedRequest extends Request {
  user?: AccessPayload;
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing_token" });
    return;
  }
  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}

// Role tiers are additive, not exclusive: a higher tier satisfies every lower
// gate (ADMIN passes a DROPPER gate, DROPPER passes a CHASER gate).
const ROLE_RANK: Record<Role, number> = {
  CHASER: 0,
  DROPPER: 1,
  ADMIN: 2,
};

// Gate a route on a minimum role. Reads the role from the DB every request (not
// the JWT) so upgrades/flips take effect immediately, without waiting for the
// 15-minute access token to expire. Assumes requireAuth ran first.
export function requireRole(min: Role) {
  return async (
    req: AuthedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: "missing_token" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    if (!user || user.status === "DISABLED") {
      res.status(403).json({ error: "account_disabled" });
      return;
    }
    if (ROLE_RANK[user.role] < ROLE_RANK[min]) {
      res.status(403).json({ error: "insufficient_role" });
      return;
    }
    next();
  };
}
