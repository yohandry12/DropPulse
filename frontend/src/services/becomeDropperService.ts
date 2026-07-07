import { httpClient, apiErrorCode } from "./httpClient";

// C1 — "Devenir dropper" (requester side). Mirrors the /dropper-requests
// endpoints (backend/src/dropper/routes.ts). The request status drives the
// 4-state screen: none (no request) → PENDING → APPROVED (code visible) →
// CONSUMED (now a Dropper).
export interface DropperRequest {
  id: string;
  projectNote: string;
  status: "PENDING" | "APPROVED" | "CONSUMED";
  code: string | null; // present only once APPROVED (channel C)
  createdAt: string; // ISO
  approvedAt: string | null; // ISO
}

// The current user's request, or null if they never submitted one (404 no_request).
export async function getMyRequest(): Promise<DropperRequest | null> {
  try {
    const res = await httpClient.get<DropperRequest>("/dropper-requests/me");
    return res.data;
  } catch (e) {
    if (apiErrorCode(e) === "no_request") return null;
    throw e;
  }
}

// Submit a new request (POST /dropper-requests). projectNote required non-empty.
export async function submitRequest(projectNote: string): Promise<void> {
  await httpClient.post("/dropper-requests", { projectNote });
}

// Redeem the validation code to become a Dropper (POST /dropper-requests/consume).
export async function consumeCode(code: string): Promise<void> {
  await httpClient.post("/dropper-requests/consume", { code });
}
