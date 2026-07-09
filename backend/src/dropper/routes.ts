import crypto from "crypto";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole, type AuthedRequest } from "../auth/middleware.js";
import { notify } from "../notifications/service.js";
import { log } from "../logger.js";

// Upgrade flow: a Chaser requests to become a Dropper, an Admin approves and a
// single-use code is issued, the requester enters the code and is promoted.
// See DESIGN_BRIEF_ADMIN.md (C1 requester side, A4 admin side).

export const dropperRouter = Router();

// Crockford-ish base32 alphabet: no 0/O/1/I to avoid transcription errors when
// the code is read off a screen and re-typed. 8 chars = ~40 bits, plenty for a
// short-lived single-use token.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (const b of bytes) {
    out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  }
  return out;
}

// --- Requester side (Chaser) ---

// Submit a request to become a Dropper. Only a plain Chaser may ask: a Dropper
// or Admin already has the capability.
dropperRouter.post("/dropper-requests", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const { projectNote } = req.body ?? {};
  if (typeof projectNote !== "string" || projectNote.trim().length === 0) {
    res.status(400).json({ error: "missing_project_note" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }
  if (user.role !== "CHASER") {
    res.status(400).json({ error: "already_dropper" });
    return;
  }

  const existing = await prisma.dropperRequest.findUnique({ where: { userId } });
  if (existing) {
    res.status(409).json({ error: "request_exists" });
    return;
  }

  const request = await prisma.dropperRequest.create({
    data: { userId, projectNote: projectNote.trim() },
    select: { id: true, status: true, createdAt: true },
  });
  res.status(201).json(request);
});

// The requester's view of their own request (drives the C1 screen states). The
// code is only present once the request is APPROVED — that is channel C.
dropperRouter.get("/dropper-requests/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const request = await prisma.dropperRequest.findUnique({
    where: { userId },
    select: {
      id: true,
      projectNote: true,
      status: true,
      code: true,
      createdAt: true,
      approvedAt: true,
    },
  });
  if (!request) {
    res.status(404).json({ error: "no_request" });
    return;
  }
  res.json(request);
});

// Enter the validation code to complete the upgrade. Flips the role to DROPPER
// and marks the request CONSUMED. The code must match the one issued for THIS
// user's request — a code cannot be redeemed by anyone else.
dropperRouter.post("/dropper-requests/consume", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const { code } = req.body ?? {};
  if (typeof code !== "string" || code.trim().length === 0) {
    res.status(400).json({ error: "missing_code" });
    return;
  }

  const request = await prisma.dropperRequest.findUnique({ where: { userId } });
  if (!request || request.status !== "APPROVED" || !request.code) {
    res.status(400).json({ error: "no_pending_code" });
    return;
  }
  if (request.code !== code.trim().toUpperCase()) {
    res.status(400).json({ error: "invalid_code" });
    return;
  }

  // Promote the user and consume the request atomically so a replay can't fire
  // twice.
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { role: "DROPPER" } }),
    prisma.dropperRequest.update({
      where: { userId },
      data: { status: "CONSUMED", consumedAt: new Date() },
    }),
  ]);

  res.json({ role: "DROPPER" });
});

// --- Admin side ---

// The habilitation queue: PENDING (to treat) and APPROVED (code issued, waiting
// for the requester to redeem). CONSUMED requests drop off the queue.
dropperRouter.get(
  "/admin/dropper-requests",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res) => {
    const requests = await prisma.dropperRequest.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        projectNote: true,
        status: true,
        code: true,
        createdAt: true,
        approvedAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
    res.json(requests);
  }
);

// Approve a pending request: generate the single-use code and reveal it to the
// admin (channel B). The same code becomes visible to the requester in-app
// (channel C) via GET /dropper-requests/me.
dropperRouter.post(
  "/admin/dropper-requests/:id/approve",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = String(req.params.id);
    const request = await prisma.dropperRequest.findUnique({ where: { id } });
    if (!request) {
      res.status(404).json({ error: "request_not_found" });
      return;
    }
    if (request.status !== "PENDING") {
      res.status(409).json({ error: "not_pending" });
      return;
    }

    const code = generateCode();
    const updated = await prisma.dropperRequest.update({
      where: { id },
      data: { status: "APPROVED", code, approvedAt: new Date() },
      select: { id: true, status: true, code: true, approvedAt: true },
    });

    // Channel D — email the code to the requester (in addition to in-app C and
    // the admin-visible B). Best-effort + forced past the email opt-out: this is
    // a transactional code they asked for, not a marketing message. A notify
    // failure must never undo the approval, so we swallow it.
    try {
      await notify({
        userId: request.userId,
        type: "DROPPER_APPROVED",
        title: "Ta demande de Dropper est acceptée",
        body: `Bienvenue ! Voici ton code d'activation à saisir dans l'app : ${code}. Entre-le pour débloquer ton espace Dropper.`,
        email: true,
        force: true,
      });
    } catch (e) {
      log.error(
        "notify(DROPPER_APPROVED) failed",
        e instanceof Error ? e.message : String(e)
      );
    }

    res.json(updated);
  }
);
