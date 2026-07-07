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

// Detailed receipt for one purchase. Mirrors GET /units/mine/:id. `order` is
// null for simulated purchases (no Stripe Order); `amountPaid` then falls back
// to the product price.
export interface Receipt {
  id: string;
  serialNumber: string;
  soldAt: string | null;
  productName: string;
  edition: string | null;
  imageUrl: string | null;
  amountPaid: number; // cents
  order: {
    id: string;
    status: "PENDING" | "PAID" | "EXPIRED";
    paidAt: string | null;
    createdAt: string;
  } | null;
}

export async function getPurchaseReceipt(id: string): Promise<Receipt> {
  const res = await httpClient.get<Receipt>(`/units/mine/${id}`);
  return res.data;
}
