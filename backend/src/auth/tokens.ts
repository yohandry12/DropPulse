import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config, requiredEnv } from "../config.js";
import { prisma } from "../prisma.js";

export interface AccessPayload {
  sub: string; // user id
  email: string;
}

// Read lazily: only the JWT-using auth layer requires this secret, not the worker.
function accessSecret(): string {
  return requiredEnv("JWT_ACCESS_SECRET");
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, accessSecret(), {
    expiresIn: config.accessTokenTtl,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, accessSecret()) as AccessPayload;
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Issue a new refresh token: random opaque string to the client, only its hash in DB.
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(
    Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  );
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt },
  });
  return raw;
}

// Rotate: validate the presented refresh token, revoke it, issue a fresh one.
// Returns the user id on success, throws on invalid/expired/revoked.
export async function rotateRefreshToken(
  raw: string
): Promise<{ userId: string; newRefresh: string }> {
  const tokenHash = hashToken(raw);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new Error("invalid_refresh_token");
  }

  // Revoke old, issue new — inside a transaction so rotation is atomic.
  const newRaw = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(
    Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  );
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: record.userId,
        tokenHash: hashToken(newRaw),
        expiresAt,
      },
    }),
  ]);

  return { userId: record.userId, newRefresh: newRaw };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  const tokenHash = hashToken(raw);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
