import { httpClient } from "./httpClient";

// One upcoming drop. Shape mirrors GET /products/upcoming
// (backend/src/units/routes.ts).
export interface UpcomingDrop {
  id: string;
  name: string;
  description: string | null;
  price: number; // cents
  dropAt: string | null; // ISO
  imageUrl: string | null; // public MinIO URL, null when no image uploaded
  unitCount: number;
}

// List upcoming drops (soonest first).
export async function getUpcomingDrops(): Promise<UpcomingDrop[]> {
  const res = await httpClient.get<UpcomingDrop[]>("/products/upcoming");
  return res.data;
}

// One drop's details by id (GET /products/:id). Same shape as a list entry.
export async function getDrop(id: string): Promise<UpcomingDrop> {
  const res = await httpClient.get<UpcomingDrop>(`/products/${id}`);
  return res.data;
}
