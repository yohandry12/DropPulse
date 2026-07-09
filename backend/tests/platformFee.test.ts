import { describe, expect, test } from "@jest/globals";
import { computePlatformFee } from "../src/payments/fee.js";

// The marketplace commission rule. PLATFORM_FEE_BPS is unset in .env.test, so
// the default 800 bps (8%) applies.
describe("computePlatformFee", () => {
  test("keeps 8% when the dropper can receive a payout", () => {
    expect(computePlatformFee(1000, true)).toBe(80); // 10.00€ -> 0.80€
    expect(computePlatformFee(4999, true)).toBe(400); // rounds 399.92 -> 400
  });

  test("keeps nothing when the dropper cannot be paid out", () => {
    // Legacy/admin drop or dropper not onboarded: platform keeps 100%, no split.
    expect(computePlatformFee(1000, false)).toBe(0);
  });

  test("never exceeds the price", () => {
    // Defensive floor: even a misconfigured rate can't charge more than the sale.
    expect(computePlatformFee(0, true)).toBe(0);
    expect(computePlatformFee(1, true)).toBe(0); // 8% of 1 cent rounds to 0
  });
});
