import type { DropStatus } from "@prisma/client";

// The display status of a drop, derived server-side from the stored authored
// status + pause flag + unit counts + schedule. Superset of the stored
// DropStatus (DRAFT | SCHEDULED): PAUSED, LIVE and SOLD_OUT are computed, never
// stored. This is the SINGLE source of truth for both the admin list badge and
// the editor's field-lock matrix — the client's own derivation is presentational
// only; the server never trusts it.
export type DropDisplayStatus = "DRAFT" | "SCHEDULED" | "PAUSED" | "LIVE" | "SOLD_OUT";

// Minimal shape needed to derive the status. Counts come from a ProductUnit
// groupBy; dropAt/pausedAt/status straight off the Product row.
export interface DeriveInput {
  status: DropStatus; // authored: DRAFT | SCHEDULED
  dropAt: Date | null;
  pausedAt: Date | null;
  soldCount: number;
  unitCount: number;
}

// Derivation order matters:
//  1. DRAFT   — authored draft, not published. Highest precedence: an unpublished
//               drop is a draft regardless of pause/schedule.
//  2. PAUSED  — admin hid a published drop. Precedes LIVE/SOLD_OUT so a paused
//               live drop reads PAUSED (its distinguishing state in the editor).
//  3. SOLD_OUT — published, opened, nothing left to sell.
//  4. LIVE    — published, dropAt passed, units remain.
//  5. SCHEDULED — published, dropAt still in the future (or unset).
export function deriveDropStatus(p: DeriveInput, now: Date = new Date()): DropDisplayStatus {
  if (p.status === "DRAFT") return "DRAFT";
  if (p.pausedAt) return "PAUSED";
  const opened = p.dropAt != null && p.dropAt.getTime() <= now.getTime();
  if (opened) {
    if (p.unitCount > 0 && p.soldCount >= p.unitCount) return "SOLD_OUT";
    return "LIVE";
  }
  return "SCHEDULED";
}

// Which Product fields the editor may change for a given display status. The
// PATCH handler enforces this: any locked field present in the body is rejected.
// editionSize is handled separately (always grow-only, never here).
//   - "fiche" fields (name/edition/description/imageKey) are ALWAYS editable —
//     even SOLD_OUT drops can fix their product sheet for the archive.
//   - pricing/schedule fields (price/maxPerBuyer/holdMinutes/dropAt) lock once a
//     drop is live-with-sales or sold out — a live sale must not be re-priced.
const FICHE_FIELDS = ["name", "edition", "description", "imageKey"] as const;
const CONFIG_FIELDS = ["price", "maxPerBuyer", "holdMinutes", "dropAt", "durationDays"] as const;

export type EditableField =
  | (typeof FICHE_FIELDS)[number]
  | (typeof CONFIG_FIELDS)[number];

// Returns the set of Product fields editable under this status. editionSize is
// NOT included (grow-only, validated on its own path).
export function editableFields(status: DropDisplayStatus): Set<EditableField> {
  const fiche = new Set<EditableField>(FICHE_FIELDS);
  switch (status) {
    case "DRAFT":
    case "SCHEDULED":
      // Nothing published / no sales locked in — everything is adjustable.
      for (const f of CONFIG_FIELDS) fiche.add(f);
      return fiche;
    case "PAUSED":
      // Suspended (often auto-expired): fiche + the lifetime, so reactivating
      // with a longer duration is possible without the worker re-pausing it
      // instantly. Pricing/schedule stay frozen (sales may exist).
      fiche.add("durationDays");
      return fiche;
    case "LIVE":
    case "SOLD_OUT":
      // Sales exist (or are in flight): fiche only, pricing/schedule frozen.
      return fiche;
  }
}

// Whether editionSize may be increased for this status. Grow-only always; here we
// gate whether ANY increase is allowed. SOLD_OUT locks the edition entirely
// (re-editions are new drops); every other state may grow the stock.
export function canGrowEdition(status: DropDisplayStatus): boolean {
  return status !== "SOLD_OUT";
}
