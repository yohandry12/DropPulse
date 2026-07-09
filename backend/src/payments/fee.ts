import { config } from "../config.js";

// Marketplace commission rule (pure — no I/O, so it's unit-testable without
// Stripe or a DB). Given the sale price and whether the dropper can receive a
// payout, return the platform fee in cents.
//
// - `canPayout` false (legacy/admin drop, or dropper not onboarded): fee is 0,
//   the platform keeps 100% and no transfer happens.
// - `canPayout` true: fee = price * platformFeeBps / 10000, floored at the price
//   so a misconfigured rate can never exceed the amount charged.
export function computePlatformFee(priceCents: number, canPayout: boolean): number {
  if (!canPayout) return 0;
  const fee = Math.round((priceCents * config.platformFeeBps) / 10000);
  return Math.min(priceCents, fee);
}
