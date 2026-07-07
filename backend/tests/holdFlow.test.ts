import { afterAll, beforeEach, describe, expect, test } from "@jest/globals";
import request from "supertest";
import { assertTransition, InvalidTransitionError } from "../src/units/stateMachine.js";
import { releaseExpiredHolds } from "../src/holds/release.js";
import { prisma } from "../src/prisma.js";
import { app, makeUser, resetDb, seedUnits } from "./helpers.js";

beforeEach(resetDb);
afterAll(async () => { await prisma.$disconnect(); });

function auth(token: string) {
  return { Authorization: `Bearer ${token}` } as const;
}

describe("state-transition integrity", () => {
  test("only allowed transitions pass; all others throw", () => {
    expect(() => assertTransition("available", "held")).not.toThrow();
    expect(() => assertTransition("held", "sold")).not.toThrow();
    expect(() => assertTransition("held", "available")).not.toThrow();

    expect(() => assertTransition("available", "sold")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("sold", "held")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("sold", "available")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("available", "available")).toThrow(InvalidTransitionError);
  });
});

describe("hold / buy flow — business logic & edge cases", () => {
  test("happy path: hold → confirm → sold", async () => {
    const [unitId] = await seedUnits(1);
    const u = await makeUser();
    const h = await request(app).post(`/units/${unitId}/hold`).set(auth(u.token));
    expect(h.status).toBe(200);
    expect(h.body.status).toBe("held");
    const c = await request(app).post(`/units/${unitId}/confirm-payment`).set(auth(u.token));
    expect(c.status).toBe(200);
    expect(c.body.status).toBe("sold");
  });

  test("one active hold per user", async () => {
    // Two units in SEPARATE drops so the per-drop maxPerBuyer cap can't fire —
    // this isolates the "one active hold per user" invariant from that cap.
    const [unitA] = await seedUnits(1);
    const [unitB] = await seedUnits(1);
    const u = await makeUser();
    await request(app).post(`/units/${unitA}/hold`).set(auth(u.token));
    const second = await request(app).post(`/units/${unitB}/hold`).set(auth(u.token));
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("user_already_holding");
  });

  test("cannot hold a sold unit", async () => {
    const [unitId] = await seedUnits(1);
    const a = await makeUser();
    await request(app).post(`/units/${unitId}/hold`).set(auth(a.token));
    await request(app).post(`/units/${unitId}/confirm-payment`).set(auth(a.token));
    const b = await makeUser();
    const res = await request(app).post(`/units/${unitId}/hold`).set(auth(b.token));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("unit_unavailable");
  });

  test("cannot confirm another user's hold", async () => {
    const [unitId] = await seedUnits(1);
    const a = await makeUser();
    const b = await makeUser();
    await request(app).post(`/units/${unitId}/hold`).set(auth(a.token));
    const res = await request(app).post(`/units/${unitId}/confirm-payment`).set(auth(b.token));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("not_your_hold");
  });

  test("cannot confirm without a hold", async () => {
    const [unitId] = await seedUnits(1);
    const u = await makeUser();
    const res = await request(app).post(`/units/${unitId}/confirm-payment`).set(auth(u.token));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("not_your_hold");
  });

  test("hold on nonexistent unit → 404", async () => {
    const u = await makeUser();
    const res = await request(app)
      .post(`/units/00000000-0000-0000-0000-000000000000/hold`)
      .set(auth(u.token));
    expect(res.status).toBe(404);
  });
});

describe("hold expiration", () => {
  test("confirm on an expired hold is rejected (self-defends, not relying on cron)", async () => {
    const [unitId] = await seedUnits(1);
    const u = await makeUser();
    await request(app).post(`/units/${unitId}/hold`).set(auth(u.token));

    // Force the hold into the past directly in the DB.
    await prisma.productUnit.update({
      where: { id: unitId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app).post(`/units/${unitId}/confirm-payment`).set(auth(u.token));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("hold_expired");
  });

  test("releaseExpiredHolds frees expired holds and leaves fresh ones", async () => {
    const ids = await seedUnits(2);
    const a = await makeUser();
    const b = await makeUser();
    await request(app).post(`/units/${ids[0]}/hold`).set(auth(a.token));
    await request(app).post(`/units/${ids[1]}/hold`).set(auth(b.token));

    // Expire only the first.
    await prisma.productUnit.update({
      where: { id: ids[0] },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const released = await releaseExpiredHolds();
    expect(released).toBe(1);

    const u0 = await prisma.productUnit.findUnique({ where: { id: ids[0] } });
    const u1 = await prisma.productUnit.findUnique({ where: { id: ids[1] } });
    expect(u0?.status).toBe("available");
    expect(u0?.heldByUserId).toBeNull();
    expect(u1?.status).toBe("held");
  });

  test("a released unit can be re-held by another user", async () => {
    const [unitId] = await seedUnits(1);
    const a = await makeUser();
    await request(app).post(`/units/${unitId}/hold`).set(auth(a.token));
    await prisma.productUnit.update({
      where: { id: unitId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await releaseExpiredHolds();

    const b = await makeUser();
    const res = await request(app).post(`/units/${unitId}/hold`).set(auth(b.token));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("held");
  });
});
