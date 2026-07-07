import { httpClient } from "./httpClient";

// Stripe Connect payout status for droppers. Mirrors GET /payouts/status
// (backend/src/payments/connect.ts).
export interface PayoutStatus {
  hasAccount: boolean;
  chargesEnabled: boolean;
}

export async function getPayoutStatus(): Promise<PayoutStatus> {
  const res = await httpClient.get<PayoutStatus>("/payouts/status");
  return res.data;
}

// Re-sync from Stripe (after returning from onboarding).
export async function refreshPayoutStatus(): Promise<PayoutStatus> {
  const res = await httpClient.post<PayoutStatus>("/payouts/refresh");
  return res.data;
}

// Start/resume onboarding — returns the hosted URL to redirect to.
export async function startPayoutOnboarding(): Promise<string> {
  const res = await httpClient.post<{ url: string }>("/payouts/onboard");
  return res.data.url;
}

// Open the Stripe Express dashboard (manage bank account / payouts) — returns
// the hosted URL to redirect to. Only valid once onboarded.
export async function openPayoutDashboard(): Promise<string> {
  const res = await httpClient.post<{ url: string }>("/payouts/dashboard");
  return res.data.url;
}
