import { httpClient } from "./httpClient";

// Live active drop + its unit grid. Shape mirrors GET /products/live
// (backend/src/units/routes.ts).

export type UnitStatus = "available" | "held" | "sold";

export interface DropUnit {
  id: string;
  serialNumber: string;
  status: UnitStatus;
}

export interface LiveDrop {
  id: string;
  name: string;
  description: string | null;
  price: number; // cents
  dropAt: string | null;
  imageUrl: string | null; // public MinIO URL, null when no image
  units: DropUnit[];
}

// Summary of a live drop (no unit grid) for the active-drop switcher. Shape
// mirrors GET /products/live (the list).
export interface LiveDropSummary {
  id: string;
  name: string;
  price: number; // cents
  dropAt: string | null;
  imageUrl: string | null;
  unitCount: number;
  availableCount: number;
}

// Every currently-live drop (summaries, most recent first). Empty array = none.
export async function getLiveDrops(): Promise<LiveDropSummary[]> {
  const res = await httpClient.get<LiveDropSummary[]>("/products/live");
  return res.data;
}

// One live drop with its full unit grid (404 → not publicly live).
export async function getLiveDrop(id: string): Promise<LiveDrop> {
  const res = await httpClient.get<LiveDrop>(`/products/live/${id}`);
  return res.data;
}

// Reserve a unit (available → held). Backend enforces one active hold per user.
export async function holdUnit(unitId: string): Promise<void> {
  await httpClient.post(`/units/${unitId}/hold`);
}

// The authed user's active hold. Shape mirrors GET /units/my-hold.
export interface ActiveHold {
  id: string;
  serialNumber: string;
  expiresAt: string; // ISO
  productName: string;
  price: number; // cents
  imageUrl: string | null; // public MinIO URL, null when no image
}

// Fetch the user's current live hold (404 → no active hold).
export async function getMyHold(): Promise<ActiveHold> {
  const res = await httpClient.get<ActiveHold>("/units/my-hold");
  return res.data;
}

// Release a hold early (held → available).
export async function releaseHold(unitId: string): Promise<void> {
  await httpClient.post(`/units/${unitId}/release`);
}

// Confirm payment (held → sold). Simulated path — kept as a fallback when
// Stripe isn't configured.
export async function confirmPayment(unitId: string): Promise<void> {
  await httpClient.post(`/units/${unitId}/confirm-payment`);
}

// Start Stripe Checkout for the held unit. Returns the hosted-page URL the
// caller redirects the browser to. On success Stripe redirects to /purchases;
// the held→sold flip happens server-side via the webhook.
export async function startCheckout(unitId: string): Promise<string> {
  const res = await httpClient.post<{ url: string }>(`/checkout/${unitId}`);
  return res.data.url;
}
