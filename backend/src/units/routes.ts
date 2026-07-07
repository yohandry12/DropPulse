import { Router } from "express";
import { requireAuth, requireRole, type AuthedRequest } from "../auth/middleware.js";
import { prisma } from "../prisma.js";
import { ConflictError, confirmPayment, holdUnit, releaseHold } from "./service.js";
import { InvalidTransitionError } from "./stateMachine.js";
import { publicUrl } from "../storage/s3.js";
import { log } from "../logger.js";

// Build the public image URL for a drop, or null when it has no uploaded image.
function imageUrlFor(imageKey: string | null): string | null {
  return imageKey ? publicUrl(imageKey) : null;
}

export const productRouter = Router();
export const unitRouter = Router();

// Map domain errors to HTTP status.
function handleError(e: unknown, res: import("express").Response): void {
  if (e instanceof ConflictError) {
    const status = e.message === "unit_not_found" ? 404 : 409;
    res.status(status).json({ error: e.message });
    return;
  }
  if (e instanceof InvalidTransitionError) {
    res.status(409).json({ error: e.message });
    return;
  }
  log.error("Unhandled route error", e instanceof Error ? e.stack ?? e.message : String(e));
  res.status(500).json({ error: "internal_error" });
}

productRouter.get("/", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { archivedAt: null, pausedAt: null },
    include: {
      units: {
        select: { id: true, serialNumber: true, status: true },
        orderBy: { serialNumber: "asc" },
      },
    },
  });
  res.json(products);
});

// Every currently-live drop (summary, no unit grid) — most recent first. Powers
// the active-drop switcher: a user can hop between several simultaneous live
// drops. "Live" = published (SCHEDULED), opened (dropAt passed), not
// archived/paused. availableCount drives the per-tab "X dispo" pill.
productRouter.get("/live", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { status: "SCHEDULED", dropAt: { lte: new Date() }, archivedAt: null, pausedAt: null },
    orderBy: { dropAt: "desc" },
    select: {
      id: true,
      name: true,
      price: true,
      dropAt: true,
      imageKey: true,
      _count: { select: { units: true } },
    },
  });

  // Available-unit count per drop in one grouped pass.
  const availGroups = await prisma.productUnit.groupBy({
    by: ["productId"],
    where: { status: "available", productId: { in: products.map((p) => p.id) } },
    _count: { _all: true },
  });
  const availByProduct = new Map(availGroups.map((g) => [g.productId, g._count._all]));

  res.json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      dropAt: p.dropAt,
      imageUrl: imageUrlFor(p.imageKey),
      unitCount: p._count.units,
      availableCount: availByProduct.get(p.id) ?? 0,
    })),
  );
});

// One live drop with its full unit grid. Declared before /:id so the two-segment
// literal path wins. 404 if the drop isn't publicly live (draft/paused/archived/
// scheduled-in-future) — same guard as the list.
productRouter.get("/live/:id", async (req, res) => {
  const product = await prisma.product.findFirst({
    where: {
      id: String(req.params.id),
      status: "SCHEDULED",
      dropAt: { lte: new Date() },
      archivedAt: null,
      pausedAt: null,
    },
    include: {
      units: {
        select: { id: true, serialNumber: true, status: true },
        orderBy: { serialNumber: "asc" },
      },
    },
  });
  if (!product) {
    res.status(404).json({ error: "no_live_drop" });
    return;
  }
  res.json({ ...product, imageUrl: imageUrlFor(product.imageKey) });
});

// Upcoming drops: those whose dropAt is still in the future, soonest first.
// Powers the landing "à venir" screen (hero = first, list = rest).
productRouter.get("/upcoming", async (_req, res) => {
  const products = await prisma.product.findMany({
    // status SCHEDULED only: a DRAFT is not published and must never surface
    // publicly, even with a future dropAt set on the create form.
    where: { status: "SCHEDULED", dropAt: { gt: new Date() }, archivedAt: null, pausedAt: null },
    orderBy: { dropAt: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      dropAt: true,
      imageKey: true,
      _count: { select: { units: true } },
    },
  });
  res.json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      dropAt: p.dropAt,
      imageUrl: imageUrlFor(p.imageKey),
      unitCount: p._count.units,
    }))
  );
});

// Max units creatable in one drop. Guards a single create transaction from
// inserting an unbounded number of rows.
const MAX_EDITION_SIZE = 100;

// Validate + normalize the POST /products body. Returns either a field-level
// error code or the clean data ready for Prisma. Kept inline (single caller).
type CreateDropInput = {
  name: string;
  description: string | null;
  edition: string | null;
  price: number;
  maxPerBuyer: number;
  holdMinutes: number;
  imageKey: string | null;
  dropAt: Date | null;
  durationDays: number | null;
  editionSize: number;
};

function parseCreateDrop(
  body: unknown
): { error: string } | { data: CreateDropInput } {
  const b = (body ?? {}) as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    return { error: "missing_name" };
  }
  // price / editionSize / maxPerBuyer / holdMinutes must be positive integers.
  const price = b.price;
  if (typeof price !== "number" || !Number.isInteger(price) || price <= 0) {
    return { error: "invalid_price" };
  }
  const editionSize = b.editionSize;
  if (
    typeof editionSize !== "number" ||
    !Number.isInteger(editionSize) ||
    editionSize < 1 ||
    editionSize > MAX_EDITION_SIZE
  ) {
    return { error: "invalid_edition_size" };
  }
  const maxPerBuyer = b.maxPerBuyer ?? 1;
  if (
    typeof maxPerBuyer !== "number" ||
    !Number.isInteger(maxPerBuyer) ||
    maxPerBuyer < 1
  ) {
    return { error: "invalid_max_per_buyer" };
  }
  const holdMinutes = b.holdMinutes ?? 10;
  if (
    typeof holdMinutes !== "number" ||
    !Number.isInteger(holdMinutes) ||
    holdMinutes < 1
  ) {
    return { error: "invalid_hold_minutes" };
  }

  // dropAt optional; if present must parse to a valid date.
  let dropAt: Date | null = null;
  if (b.dropAt != null) {
    if (typeof b.dropAt !== "string") return { error: "invalid_drop_at" };
    const d = new Date(b.dropAt);
    if (Number.isNaN(d.getTime())) return { error: "invalid_drop_at" };
    dropAt = d;
  }

  // durationDays optional; if present must be a positive integer (days of life).
  let durationDays: number | null = null;
  if (b.durationDays != null) {
    if (
      typeof b.durationDays !== "number" ||
      !Number.isInteger(b.durationDays) ||
      b.durationDays < 1
    ) {
      return { error: "invalid_duration_days" };
    }
    durationDays = b.durationDays;
  }

  const description =
    typeof b.description === "string" && b.description.trim().length > 0
      ? b.description.trim()
      : null;
  const edition =
    typeof b.edition === "string" && b.edition.trim().length > 0
      ? b.edition.trim()
      : null;
  const imageKey =
    typeof b.imageKey === "string" && b.imageKey.trim().length > 0
      ? b.imageKey.trim()
      : null;

  return {
    data: {
      name: b.name.trim(),
      description,
      edition,
      price,
      maxPerBuyer,
      holdMinutes,
      imageKey,
      dropAt,
      durationDays,
      editionSize,
    },
  };
}

// Create a drop (Dropper/Admin only). Creates the Product plus its numbered
// ProductUnit rows (serial 1..editionSize) in one transaction, so the drop is
// complete and sellable on create. status is always DRAFT at create — the
// creator publishes later. createdById is stamped from the token.
productRouter.post(
  "/",
  requireAuth,
  requireRole("DROPPER"),
  async (req: AuthedRequest, res) => {
    const parsed = parseCreateDrop(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const d = parsed.data;

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: d.name,
          description: d.description,
          edition: d.edition,
          price: d.price,
          maxPerBuyer: d.maxPerBuyer,
          holdMinutes: d.holdMinutes,
          imageKey: d.imageKey,
          dropAt: d.dropAt,
          durationDays: d.durationDays,
          createdById: req.user!.sub,
        },
      });
      // Serial prefix from the new product id keeps serials globally unique
      // (serialNumber is unique across all drops) without a user-supplied prefix.
      const prefix = created.id.slice(0, 8);
      await tx.productUnit.createMany({
        data: Array.from({ length: d.editionSize }, (_, i) => ({
          productId: created.id,
          serialNumber: `${prefix}-${String(i + 1).padStart(4, "0")}`,
        })),
      });
      return created;
    });

    res.status(201).json({ id: product.id, status: product.status });
  }
);

// The authed Dropper's own drops (D2 "Mes drops"). Declared before /:id so the
// literal path wins over the param route.
productRouter.get(
  "/mine",
  requireAuth,
  requireRole("DROPPER"),
  async (req: AuthedRequest, res) => {
    const userId = req.user!.sub;
    // Sort by opening date (drops with no dropAt sink last), newest opening first
    // — matches the "Triés par date d'ouverture" maquette.
    const products = await prisma.product.findMany({
      where: { createdById: userId },
      orderBy: [{ dropAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        edition: true,
        price: true,
        status: true,
        imageKey: true,
        dropAt: true,
        createdAt: true,
        _count: { select: { units: true } },
      },
    });

    // Sold count per drop in one grouped query, then merged in. Powers the
    // "stock écoulé" bar and the derived LIVE/SOLD_OUT badges on the client.
    const soldGroups = await prisma.productUnit.groupBy({
      by: ["productId"],
      where: { status: "sold", product: { createdById: userId } },
      _count: { _all: true },
    });
    const soldByProduct = new Map(
      soldGroups.map((g) => [g.productId, g._count._all])
    );

    res.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        edition: p.edition,
        price: p.price,
        status: p.status,
        imageKey: p.imageKey,
        imageUrl: imageUrlFor(p.imageKey),
        dropAt: p.dropAt,
        createdAt: p.createdAt,
        unitCount: p._count.units,
        soldCount: soldByProduct.get(p.id) ?? 0,
      }))
    );
  }
);

// Publish a drop: DRAFT -> SCHEDULED. Allowed for the drop's owner or any Admin
// (moderation). DROPPER gate first (Chasers can't own drops); ownership/admin
// checked against the row. Declared before /:id so the literal path wins.
productRouter.post(
  "/:id/publish",
  requireAuth,
  requireRole("DROPPER"),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const userId = req.user!.sub;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { createdById: true, status: true },
    });
    if (!product) {
      res.status(404).json({ error: "product_not_found" });
      return;
    }

    // Owner or Admin only.
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isOwner = product.createdById === userId;
    const isAdmin = me?.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: "not_owner" });
      return;
    }

    if (product.status !== "DRAFT") {
      res.status(409).json({ error: "not_draft" });
      return;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { status: "SCHEDULED" },
      select: { id: true, status: true },
    });
    res.json(updated);
  }
);

// Owner/Admin management view of one drop (D3). Returns the full drop config +
// live unit breakdown (available / held / sold) for the "État du stock" panel.
// Declared before /:id so the two-segment path wins.
productRouter.get(
  "/:id/manage",
  requireAuth,
  requireRole("DROPPER"),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const userId = req.user!.sub;

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        edition: true,
        description: true,
        price: true,
        maxPerBuyer: true,
        holdMinutes: true,
        imageKey: true,
        status: true,
        dropAt: true,
        createdById: true,
      },
    });
    if (!product) {
      res.status(404).json({ error: "product_not_found" });
      return;
    }

    // Owner or Admin only.
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (product.createdById !== userId && me?.role !== "ADMIN") {
      res.status(403).json({ error: "not_owner" });
      return;
    }

    // Unit breakdown by status in one grouped query.
    const groups = await prisma.productUnit.groupBy({
      by: ["status"],
      where: { productId: id },
      _count: { _all: true },
    });
    const byStatus = new Map(groups.map((g) => [g.status, g._count._all]));
    const available = byStatus.get("available") ?? 0;
    const held = byStatus.get("held") ?? 0;
    const sold = byStatus.get("sold") ?? 0;

    res.json({
      id: product.id,
      name: product.name,
      edition: product.edition,
      description: product.description,
      price: product.price,
      maxPerBuyer: product.maxPerBuyer,
      holdMinutes: product.holdMinutes,
      imageKey: product.imageKey,
      imageUrl: imageUrlFor(product.imageKey),
      status: product.status,
      dropAt: product.dropAt,
      available,
      held,
      sold,
      unitCount: available + held + sold,
    });
  }
);

// A single drop's details (no unit grid). Declared after the static /live and
// /upcoming routes so those win over this :id param. Powers the drop-detail page.
productRouter.get("/:id", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      status: true,
      dropAt: true,
      imageKey: true,
      archivedAt: true,
      pausedAt: true,
      _count: { select: { units: true } },
    },
  });
  // A DRAFT is unpublished: it does not exist for the public, even via a direct
  // link. Treated as not-found so a brouillon never leaks its details.
  if (!product || product.status === "DRAFT") {
    res.status(404).json({ error: "product_not_found" });
    return;
  }
  // Archived or paused: hidden from the public. Distinct codes so the client can
  // show a guiding "ce drop a été retiré" message instead of a bare not-found.
  // Both map to the same visitor-facing panel; paused stays a separate code in
  // case that guidance ever needs to differ.
  if (product.archivedAt) {
    res.status(410).json({ error: "product_archived" });
    return;
  }
  if (product.pausedAt) {
    res.status(410).json({ error: "product_paused" });
    return;
  }
  res.json({
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    dropAt: product.dropAt,
    imageUrl: imageUrlFor(product.imageKey),
    unitCount: product._count.units,
  });
});

// List the authed user's purchases: units they paid for (status = sold,
// still stamped with their heldByUserId). Newest first.
unitRouter.get("/mine", requireAuth, async (req: AuthedRequest, res) => {
  const units = await prisma.productUnit.findMany({
    where: { status: "sold", heldByUserId: req.user!.sub },
    include: { product: { select: { name: true, price: true, imageKey: true } } },
    orderBy: { soldAt: "desc" },
  });
  res.json(
    units.map((u) => ({
      id: u.id,
      serialNumber: u.serialNumber,
      soldAt: u.soldAt,
      productName: u.product.name,
      price: u.product.price,
      imageUrl: imageUrlFor(u.product.imageKey),
    }))
  );
});

// The authed user's active hold (if any): a still-live held unit + its product
// and deadline. Powers the hold screen without passing state between routes.
unitRouter.get("/my-hold", requireAuth, async (req: AuthedRequest, res) => {
  const unit = await prisma.productUnit.findFirst({
    where: {
      status: "held",
      heldByUserId: req.user!.sub,
      expiresAt: { gt: new Date() },
    },
    include: { product: { select: { name: true, price: true, imageKey: true } } },
  });
  if (!unit) {
    res.status(404).json({ error: "no_active_hold" });
    return;
  }
  res.json({
    id: unit.id,
    serialNumber: unit.serialNumber,
    expiresAt: unit.expiresAt,
    productName: unit.product.name,
    price: unit.product.price,
    imageUrl: imageUrlFor(unit.product.imageKey),
  });
});

unitRouter.post("/:id/hold", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const unit = await holdUnit(String(req.params.id), req.user!.sub);
    res.json({ id: unit.id, status: unit.status, expiresAt: unit.expiresAt });
  } catch (e) {
    handleError(e, res);
  }
});

unitRouter.post("/:id/release", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const unit = await releaseHold(String(req.params.id), req.user!.sub);
    res.json({ id: unit.id, status: unit.status });
  } catch (e) {
    handleError(e, res);
  }
});

unitRouter.post(
  "/:id/confirm-payment",
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const unit = await confirmPayment(String(req.params.id), req.user!.sub);
      res.json({ id: unit.id, status: unit.status, soldAt: unit.soldAt });
    } catch (e) {
      handleError(e, res);
    }
  }
);
