import { httpClient } from "./httpClient";

// A3 — drop management API client. Mirrors backend/src/admin/products.ts.

// Authored status stored on the row. LIVE / SOLD_OUT are DERIVED client-side
// (see deriveDropStatus) from status + dropAt + counts — never stored.
export type DropStatus = "DRAFT" | "SCHEDULED";

// The display status shown in the table + filters. Superset of the stored
// status: PAUSED, LIVE and SOLD_OUT are computed at read time. Mirrors the
// backend admin/dropStatus.ts derivation exactly.
export type DropDisplayStatus = "DRAFT" | "SCHEDULED" | "PAUSED" | "LIVE" | "SOLD_OUT";

export interface AdminProduct {
  id: string;
  name: string;
  edition: string | null;
  price: number; // cents
  status: DropStatus;
  dropAt: string | null; // ISO
  archivedAt: string | null; // ISO — non-null = archived (soft-deleted)
  pausedAt: string | null; // ISO — non-null = paused (hidden from public, reversible)
  createdAt: string; // ISO
  creator: { id: string; email: string; name: string | null } | null; // null for legacy seeded drops
  unitCount: number;
  soldCount: number;
  firstSerial: string | null;
  lastSerial: string | null;
}

// Every drop across the platform, newest first (archived included, flagged).
export async function getProducts(): Promise<AdminProduct[]> {
  const res = await httpClient.get<AdminProduct[]>("/admin/products");
  return res.data;
}

// Soft-delete (archive) a drop. Backend refuses with 409 has_sales when any unit
// is already sold — the caller surfaces that as a guiding message.
export async function archiveProduct(id: string): Promise<void> {
  await httpClient.patch(`/admin/products/${id}/archive`);
}

// Derive the display status from the stored state + counts, mirroring the
// backend admin/dropStatus.ts EXACTLY. Order matters:
//   DRAFT (unpublished, highest precedence) → PAUSED (admin hid a published drop,
//   before LIVE/SOLD_OUT) → SOLD_OUT → LIVE → SCHEDULED (future/unset dropAt).
export function deriveDropStatus(p: AdminProduct): DropDisplayStatus {
  if (p.status === "DRAFT") return "DRAFT";
  if (p.pausedAt) return "PAUSED";
  const opened = p.dropAt != null && new Date(p.dropAt).getTime() <= Date.now();
  if (opened) {
    if (p.unitCount > 0 && p.soldCount >= p.unitCount) return "SOLD_OUT";
    return "LIVE";
  }
  return "SCHEDULED";
}
