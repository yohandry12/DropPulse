import { httpClient } from "./httpClient";

// Owner/Admin management view of one drop (D3). Mirrors GET /products/:id/manage
// (backend/src/units/routes.ts). status is stored (DRAFT|SCHEDULED); LIVE /
// SOLD_OUT are derived on the client from dropAt + sold/total.
export interface ManagedDrop {
  id: string;
  name: string;
  edition: string | null;
  description: string | null;
  price: number; // cents
  maxPerBuyer: number;
  holdMinutes: number;
  imageKey: string | null;
  imageUrl: string | null; // public MinIO URL, null when no image
  status: "DRAFT" | "SCHEDULED";
  dropAt: string | null; // ISO
  available: number;
  held: number;
  sold: number;
  unitCount: number;
}

// Fetch one drop's management view (owner/admin only; 403 otherwise).
export async function getManagedDrop(id: string): Promise<ManagedDrop> {
  const res = await httpClient.get<ManagedDrop>(`/products/${id}/manage`);
  return res.data;
}
