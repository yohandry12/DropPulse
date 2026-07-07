import { httpClient } from "./httpClient";

// Admin back-office API client. Mirrors the /admin/* endpoints
// (backend/src/dropper/routes.ts for A4; users/drops added in later slices).

// A4 — one row in the habilitation queue. PENDING = to treat, APPROVED = code
// issued, waiting for the requester to redeem. CONSUMED rows drop off the queue.
export interface AdminDropperRequest {
  id: string;
  projectNote: string;
  status: "PENDING" | "APPROVED";
  code: string | null; // present once APPROVED (channel B — admin-visible)
  createdAt: string; // ISO
  approvedAt: string | null; // ISO
  user: { id: string; email: string; name: string | null };
}

// The habilitation queue (PENDING + APPROVED, oldest first).
export async function getDropperRequests(): Promise<AdminDropperRequest[]> {
  const res = await httpClient.get<AdminDropperRequest[]>("/admin/dropper-requests");
  return res.data;
}

// Approve a pending request → generates + reveals the single-use code.
export async function approveDropperRequest(
  id: string,
): Promise<{ id: string; status: "APPROVED"; code: string; approvedAt: string }> {
  const res = await httpClient.post(`/admin/dropper-requests/${id}/approve`);
  return res.data;
}
