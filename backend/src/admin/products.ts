import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole, type AuthedRequest } from "../auth/middleware.js";
import { deriveDropStatus, editableFields, canGrowEdition } from "./dropStatus.js";
import { publicUrl } from "../storage/s3.js";

// A3 — drop management (admin back-office). List every drop across the platform
// with its creator, derived status, serial range and sold-through, plus a
// soft-delete (archive) action. Archiving is refused when any unit is already
// sold, so purchase history is never orphaned. See DESIGN_BRIEF_ADMIN.md (A3).

export const adminProductsRouter = Router();

// GET /admin/products — every drop, newest first. Returns the authored status
// (DRAFT | SCHEDULED) plus the counts the client needs to DERIVE the display
// status (LIVE / SOLD_OUT) exactly like the public/owner views do. The serial
// range (first → last serialNumber) powers the "PLAGE" column.
adminProductsRouter.get(
  "/admin/products",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res) => {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        edition: true,
        price: true,
        status: true,
        dropAt: true,
        archivedAt: true,
        pausedAt: true,
        createdAt: true,
        createdBy: { select: { id: true, email: true, name: true } },
        _count: { select: { units: true } },
      },
    });

    // Sold count per drop in one grouped pass (drives the "écoulé" bar and the
    // derived SOLD_OUT badge). Merged in memory — back-office = few drops.
    const soldGroups = await prisma.productUnit.groupBy({
      by: ["productId"],
      where: { status: "sold" },
      _count: { _all: true },
    });
    const soldByProduct = new Map(soldGroups.map((g) => [g.productId, g._count._all]));

    // First + last serial per drop for the "PLAGE" column. Serials are
    // zero-padded and share a per-drop prefix, so string min/max = numeric order.
    const serialAgg = await prisma.productUnit.groupBy({
      by: ["productId"],
      _min: { serialNumber: true },
      _max: { serialNumber: true },
    });
    const serialByProduct = new Map(
      serialAgg.map((s) => [s.productId, { first: s._min.serialNumber, last: s._max.serialNumber }]),
    );

    res.json(
      products.map((p) => {
        const serials = serialByProduct.get(p.id);
        return {
          id: p.id,
          name: p.name,
          edition: p.edition,
          price: p.price,
          status: p.status,
          dropAt: p.dropAt,
          archivedAt: p.archivedAt,
          pausedAt: p.pausedAt,
          createdAt: p.createdAt,
          creator: p.createdBy
            ? { id: p.createdBy.id, email: p.createdBy.email, name: p.createdBy.name }
            : null,
          unitCount: p._count.units,
          soldCount: soldByProduct.get(p.id) ?? 0,
          firstSerial: serials?.first ?? null,
          lastSerial: serials?.last ?? null,
        };
      }),
    );
  },
);

// PATCH /admin/products/:id/archive — soft-delete a drop. Sets archivedAt so the
// drop vanishes from every public listing (upcoming/live/detail) while its rows
// survive. Refused (409 has_sales) when any unit is already sold — those buyers
// keep their purchase, so the drop can't be pulled from under them. Idempotent-ish:
// re-archiving an already-archived drop just refreshes the timestamp.
adminProductsRouter.patch(
  "/admin/products/:id/archive",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!product) {
      res.status(404).json({ error: "product_not_found" });
      return;
    }

    const soldCount = await prisma.productUnit.count({
      where: { productId: id, status: "sold" },
    });
    if (soldCount > 0) {
      res.status(409).json({ error: "has_sales" });
      return;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { archivedAt: new Date() },
      select: { id: true, archivedAt: true },
    });
    res.json(updated);
  },
);

// Full editor payload for one drop: every editable field + counts + derived
// status + which fields the current status locks, so the UI renders the right
// locks without re-deriving policy. Serves GET /admin/products/:id/edit and is
// also the shape PATCH returns after a save.
async function loadEditorView(id: string) {
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
      durationDays: true,
      pausedAt: true,
      archivedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });
  if (!product) return null;

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
  const unitCount = available + held + sold;

  const displayStatus = deriveDropStatus({
    status: product.status,
    dropAt: product.dropAt,
    pausedAt: product.pausedAt,
    soldCount: sold,
    unitCount,
  });

  return {
    id: product.id,
    name: product.name,
    edition: product.edition,
    description: product.description,
    price: product.price,
    maxPerBuyer: product.maxPerBuyer,
    holdMinutes: product.holdMinutes,
    imageKey: product.imageKey,
    // Public URL for the editor's preview panel (null when no image uploaded).
    imageUrl: product.imageKey ? publicUrl(product.imageKey) : null,
    dropAt: product.dropAt,
    durationDays: product.durationDays,
    pausedAt: product.pausedAt,
    archivedAt: product.archivedAt,
    createdAt: product.createdAt,
    creator: product.createdBy
      ? { id: product.createdBy.id, email: product.createdBy.email, name: product.createdBy.name }
      : null,
    available,
    held,
    sold,
    unitCount,
    displayStatus,
    // The exact fields the client may edit under this status (fiche always;
    // pricing/schedule only when unlocked). editionSize grow-ability is separate.
    editableFields: [...editableFields(displayStatus)],
    canGrowEdition: canGrowEdition(displayStatus),
  };
}

// GET /admin/products/:id/edit — everything the editor needs for one drop.
adminProductsRouter.get(
  "/admin/products/:id/edit",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const view = await loadEditorView(String(req.params.id));
    if (!view) {
      res.status(404).json({ error: "product_not_found" });
      return;
    }
    res.json(view);
  },
);

// Parse + validate an editor PATCH body against the fields the status allows.
// Returns a Prisma update payload for the fiche/config fields, plus the optional
// editionSize target (validated separately for grow-only). Locked fields present
// in the body are REJECTED (409 field_locked) rather than silently dropped, so a
// stale client can't think it changed a price it couldn't.
const MAX_EDITION_SIZE = 100;

type ParsedPatch =
  | { error: string }
  | { data: Record<string, unknown>; editionSize: number | null };

function parseEditorPatch(
  body: unknown,
  editable: Set<string>,
  canGrow: boolean,
): ParsedPatch {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  // Reject any locked field the client tried to send.
  const CONFIG = ["price", "maxPerBuyer", "holdMinutes", "dropAt", "durationDays"];
  for (const key of ["name", "edition", "description", "imageKey", ...CONFIG]) {
    if (b[key] === undefined) continue;
    if (!editable.has(key)) return { error: "field_locked" };
  }

  // Fiche fields.
  if (b.name !== undefined) {
    if (typeof b.name !== "string" || b.name.trim().length === 0) return { error: "missing_name" };
    data.name = b.name.trim();
  }
  if (b.edition !== undefined) {
    data.edition =
      typeof b.edition === "string" && b.edition.trim().length > 0 ? b.edition.trim() : null;
  }
  if (b.description !== undefined) {
    data.description =
      typeof b.description === "string" && b.description.trim().length > 0
        ? b.description.trim()
        : null;
  }
  if (b.imageKey !== undefined) {
    data.imageKey =
      typeof b.imageKey === "string" && b.imageKey.trim().length > 0 ? b.imageKey.trim() : null;
  }

  // Config fields (only reachable when editable — checked above).
  if (b.price !== undefined) {
    if (typeof b.price !== "number" || !Number.isInteger(b.price) || b.price <= 0) {
      return { error: "invalid_price" };
    }
    data.price = b.price;
  }
  if (b.maxPerBuyer !== undefined) {
    if (typeof b.maxPerBuyer !== "number" || !Number.isInteger(b.maxPerBuyer) || b.maxPerBuyer < 1) {
      return { error: "invalid_max_per_buyer" };
    }
    data.maxPerBuyer = b.maxPerBuyer;
  }
  if (b.holdMinutes !== undefined) {
    if (typeof b.holdMinutes !== "number" || !Number.isInteger(b.holdMinutes) || b.holdMinutes < 1) {
      return { error: "invalid_hold_minutes" };
    }
    data.holdMinutes = b.holdMinutes;
  }
  if (b.dropAt !== undefined) {
    if (b.dropAt === null) {
      data.dropAt = null;
    } else if (typeof b.dropAt === "string") {
      const d = new Date(b.dropAt);
      if (Number.isNaN(d.getTime())) return { error: "invalid_drop_at" };
      data.dropAt = d;
    } else {
      return { error: "invalid_drop_at" };
    }
  }
  if (b.durationDays !== undefined) {
    if (b.durationDays === null) {
      data.durationDays = null; // clearing = lives indefinitely
    } else if (
      typeof b.durationDays === "number" &&
      Number.isInteger(b.durationDays) &&
      b.durationDays >= 1
    ) {
      data.durationDays = b.durationDays;
    } else {
      return { error: "invalid_duration_days" };
    }
  }

  // editionSize: optional, grow-only. Validated against the current unit count
  // by the caller (which knows it); here we only range-check the raw value.
  let editionSize: number | null = null;
  if (b.editionSize !== undefined) {
    if (!canGrow) return { error: "edition_locked" };
    if (
      typeof b.editionSize !== "number" ||
      !Number.isInteger(b.editionSize) ||
      b.editionSize < 1 ||
      b.editionSize > MAX_EDITION_SIZE
    ) {
      return { error: "invalid_edition_size" };
    }
    editionSize = b.editionSize;
  }

  return { data, editionSize };
}

// PATCH /admin/products/:id — status-aware update. Applies only the fields the
// drop's DERIVED status permits (locked fields → 409 field_locked). editionSize
// is grow-only: increasing it appends new numbered ProductUnit rows (never drops
// existing ones); shrinking → 409 cannot_shrink. Returns the fresh editor view.
adminProductsRouter.patch(
  "/admin/products/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);

    // Derive current status from live counts to decide the lock matrix.
    const current = await loadEditorView(id);
    if (!current) {
      res.status(404).json({ error: "product_not_found" });
      return;
    }
    if (current.archivedAt) {
      res.status(409).json({ error: "product_archived" });
      return;
    }

    const editable = new Set<string>(current.editableFields);
    const parsed = parseEditorPatch(req.body, editable, current.canGrowEdition);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    // Grow-only edition check against the ACTUAL total units.
    let growBy = 0;
    if (parsed.editionSize !== null) {
      if (parsed.editionSize < current.unitCount) {
        res.status(409).json({ error: "cannot_shrink" });
        return;
      }
      growBy = parsed.editionSize - current.unitCount;
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(parsed.data).length > 0) {
        await tx.product.update({ where: { id }, data: parsed.data });
      }
      if (growBy > 0) {
        // Append serials continuing the existing per-drop prefix + numbering.
        const prefix = id.slice(0, 8);
        await tx.productUnit.createMany({
          data: Array.from({ length: growBy }, (_, i) => ({
            productId: id,
            serialNumber: `${prefix}-${String(current.unitCount + i + 1).padStart(4, "0")}`,
          })),
        });
      }
    });

    const fresh = await loadEditorView(id);
    res.json(fresh);
  },
);

// PATCH /admin/products/:id/pause — hide a published drop from the public without
// touching its sales (reversible). No-op-safe: re-pausing refreshes the stamp.
// Refused on a DRAFT (nothing published to pause) and on an archived drop.
adminProductsRouter.patch(
  "/admin/products/:id/pause",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = String(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, status: true, archivedAt: true },
    });
    if (!product) {
      res.status(404).json({ error: "product_not_found" });
      return;
    }
    if (product.archivedAt) {
      res.status(409).json({ error: "product_archived" });
      return;
    }
    if (product.status === "DRAFT") {
      res.status(409).json({ error: "not_published" });
      return;
    }
    const updated = await prisma.product.update({
      where: { id },
      data: { pausedAt: new Date() },
      select: { id: true, pausedAt: true },
    });
    res.json(updated);
  },
);

// PATCH /admin/products/:id/resume — un-pause (clear pausedAt).
adminProductsRouter.patch(
  "/admin/products/:id/resume",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = String(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!product) {
      res.status(404).json({ error: "product_not_found" });
      return;
    }
    const updated = await prisma.product.update({
      where: { id },
      data: { pausedAt: null },
      select: { id: true, pausedAt: true },
    });
    res.json(updated);
  },
);

// PATCH /admin/products/:id/unpublish — SCHEDULED → DRAFT. Only allowed when the
// drop has no sales (a sold unit means it went live for real). Clears any pause.
adminProductsRouter.patch(
  "/admin/products/:id/unpublish",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = String(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, status: true, archivedAt: true },
    });
    if (!product) {
      res.status(404).json({ error: "product_not_found" });
      return;
    }
    if (product.archivedAt) {
      res.status(409).json({ error: "product_archived" });
      return;
    }
    if (product.status !== "SCHEDULED") {
      res.status(409).json({ error: "not_scheduled" });
      return;
    }
    const soldCount = await prisma.productUnit.count({
      where: { productId: id, status: "sold" },
    });
    if (soldCount > 0) {
      res.status(409).json({ error: "has_sales" });
      return;
    }
    const updated = await prisma.product.update({
      where: { id },
      data: { status: "DRAFT", pausedAt: null },
      select: { id: true, status: true },
    });
    res.json(updated);
  },
);
