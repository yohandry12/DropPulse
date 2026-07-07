import { httpClient } from "./httpClient";

// One purchase = a sold unit owned by the authed user.
// Shape mirrors GET /units/mine (backend/src/units/routes.ts).
export interface Purchase {
  id: string;
  serialNumber: string;
  soldAt: string | null;
  productName: string;
  price: number; // cents
  imageUrl: string | null; // public MinIO URL, null when no image
}

// List the authed user's purchases (newest first).
export async function getMyPurchases(): Promise<Purchase[]> {
  const res = await httpClient.get<Purchase[]>("/units/mine");
  return res.data;
}
