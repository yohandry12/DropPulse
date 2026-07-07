import bcrypt from "bcryptjs";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "./middleware.js";
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from "./tokens.js";

export const authRouter = Router();

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

authRouter.post("/register", async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!isValidEmail(email) || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "invalid_credentials_format" });
    return;
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "missing_name" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "email_taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name: name.trim(), passwordHash },
  });

  res.status(201).json({ id: user.id, email: user.email, name: user.name });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "invalid_credentials_format" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }
  if (user.status === "DISABLED") {
    res.status(403).json({ error: "account_disabled" });
    return;
  }

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);
  res.json({ accessToken, refreshToken });
});

authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken !== "string") {
    res.status(400).json({ error: "missing_refresh_token" });
    return;
  }
  try {
    const { userId, newRefresh } = await rotateRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: "invalid_refresh_token" });
      return;
    }
    const accessToken = signAccessToken({ sub: user.id, email: user.email });
    res.json({ accessToken, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: "invalid_refresh_token" });
  }
});

authRouter.post("/logout", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken === "string") {
    await revokeRefreshToken(refreshToken);
  }
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const [user, purchaseCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
    }),
    prisma.productUnit.count({ where: { status: "sold", heldByUserId: userId } }),
  ]);
  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    purchaseCount,
  });
});
