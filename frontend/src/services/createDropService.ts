import { httpClient } from "./httpClient";

// Create + publish a drop (Dropper/Admin). Mirrors POST /products and
// POST /products/:id/publish (backend/src/units/routes.ts).

export interface CreateDropPayload {
  name: string;
  description: string | null;
  edition: string | null;
  price: number; // cents
  maxPerBuyer: number;
  holdMinutes: number;
  editionSize: number;
  imageKey: string | null;
  dropAt: string | null; // ISO
  durationDays: number | null; // days of life after opening; null = indefinite
}

// POST /products → { id, status: "DRAFT" }. Creates the drop shell + numbered
// units. Always DRAFT at create.
export async function createDrop(
  payload: CreateDropPayload,
): Promise<{ id: string; status: string }> {
  const res = await httpClient.post<{ id: string; status: string }>(
    "/products",
    payload,
  );
  return res.data;
}

// POST /products/:id/publish → { id, status: "SCHEDULED" }. DRAFT → SCHEDULED.
export async function publishDrop(
  id: string,
): Promise<{ id: string; status: string }> {
  const res = await httpClient.post<{ id: string; status: string }>(
    `/products/${id}/publish`,
  );
  return res.data;
}
