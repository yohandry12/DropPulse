import { httpClient } from "./httpClient";

// A3 editor — one drop's full editable view + status-aware mutations. Mirrors
// backend/src/admin/products.ts (GET /:id/edit, PATCH /:id, pause/resume/unpublish).

// The display status the server derived. Superset of the stored DRAFT|SCHEDULED:
// PAUSED, LIVE, SOLD_OUT are computed server-side and drive the lock matrix.
export type DropDisplayStatus = "DRAFT" | "SCHEDULED" | "PAUSED" | "LIVE" | "SOLD_OUT";

// Product fields the editor may touch (fiche always; pricing/schedule only when
// unlocked). Matches the backend EditableField union.
export type EditableField =
  | "name"
  | "edition"
  | "description"
  | "imageKey"
  | "price"
  | "maxPerBuyer"
  | "holdMinutes"
  | "dropAt"
  | "durationDays";

export interface DropEditorView {
  id: string;
  name: string;
  edition: string | null;
  description: string | null;
  price: number; // cents
  maxPerBuyer: number;
  holdMinutes: number;
  imageKey: string | null;
  imageUrl: string | null; // public MinIO URL for preview, null when no image
  dropAt: string | null; // ISO
  durationDays: number | null; // days of life after opening; null = indefinite
  pausedAt: string | null; // ISO
  archivedAt: string | null; // ISO
  createdAt: string; // ISO
  creator: { id: string; email: string; name: string | null } | null;
  available: number;
  held: number;
  sold: number;
  unitCount: number;
  displayStatus: DropDisplayStatus;
  editableFields: EditableField[]; // which fields the current status unlocks
  canGrowEdition: boolean; // whether editionSize may be increased
}

// The mutable payload. Every field optional — send only what changed. editionSize
// is the target total (grow-only server-side); dropAt accepts null to clear.
export interface DropEditorPatch {
  name?: string;
  edition?: string | null;
  description?: string | null;
  imageKey?: string | null;
  price?: number;
  maxPerBuyer?: number;
  holdMinutes?: number;
  dropAt?: string | null;
  durationDays?: number | null;
  editionSize?: number;
}

export async function getDropEditor(id: string): Promise<DropEditorView> {
  const res = await httpClient.get<DropEditorView>(`/admin/products/${id}/edit`);
  return res.data;
}

// Status-aware update. Returns the fresh editor view (re-derived status + counts).
// Locked fields in the payload → 409 field_locked; shrinking editionSize → 409
// cannot_shrink.
export async function patchDrop(id: string, patch: DropEditorPatch): Promise<DropEditorView> {
  const res = await httpClient.patch<DropEditorView>(`/admin/products/${id}`, patch);
  return res.data;
}

// Hide a published drop from the public without losing sales (reversible).
export async function pauseDrop(id: string): Promise<void> {
  await httpClient.patch(`/admin/products/${id}/pause`);
}

export async function resumeDrop(id: string): Promise<void> {
  await httpClient.patch(`/admin/products/${id}/resume`);
}

// SCHEDULED → DRAFT (no-sales only).
export async function unpublishDrop(id: string): Promise<void> {
  await httpClient.patch(`/admin/products/${id}/unpublish`);
}

// DRAFT → SCHEDULED. Uses the existing owner/admin publish route: with a dropAt
// set the drop is "programmé", without it goes live as soon as a date is set.
export async function publishDrop(id: string): Promise<void> {
  await httpClient.post(`/products/${id}/publish`);
}
