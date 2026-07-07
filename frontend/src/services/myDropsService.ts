import { httpClient } from "./httpClient";

// A drop owned by the current dropper. Shape mirrors GET /products/mine
// (backend/src/units/routes.ts). status is the STORED state (DRAFT|SCHEDULED);
// LIVE / SOLD_OUT are derived on the client from dropAt + sold/total.
export interface MyDrop {
  id: string;
  name: string;
  edition: string | null;
  price: number; // cents
  status: "DRAFT" | "SCHEDULED";
  imageKey: string | null;
  imageUrl: string | null; // public MinIO URL, null when no image
  dropAt: string | null; // ISO
  createdAt: string; // ISO
  unitCount: number;
  soldCount: number;
}

// List the authed dropper's own drops (opening-date desc).
export async function getMyDrops(): Promise<MyDrop[]> {
  const res = await httpClient.get<MyDrop[]>("/products/mine");
  return res.data;
}
