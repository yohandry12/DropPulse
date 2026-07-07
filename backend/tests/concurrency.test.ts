import { afterAll, beforeEach, describe, expect, test } from "@jest/globals";
import request from "supertest";
import { prisma } from "../src/prisma.js";
import { app, makeUser, resetDb, seedUnits } from "./helpers.js";

beforeEach(resetDb);
afterAll(async () => { await prisma.$disconnect(); });

describe("concurrency — no unit sold twice", () => {
  test("N users racing the same unit → exactly one hold succeeds", async () => {
    const N = 25;
    const [unitId] = await seedUnits(1);
    const users = await Promise.all(Array.from({ length: N }, () => makeUser()));

    const results = await Promise.all(
      users.map((u) =>
        request(app).post(`/units/${unitId}/hold`).set("Authorization", `Bearer ${u.token}`)
      )
    );

    const ok = results.filter((r) => r.status === 200);
    const conflict = results.filter((r) => r.status === 409);
    expect(ok).toHaveLength(1);
    expect(conflict).toHaveLength(N - 1);
    expect(conflict[0].body.error).toBe("unit_unavailable");

    // DB truth: exactly one held row for this unit.
    const unit = await prisma.productUnit.findUnique({ where: { id: unitId } });
    expect(unit?.status).toBe("held");
  });

  test("racing confirm-payment on a single hold → sold exactly once", async () => {
    const [unitId] = await seedUnits(1);
    const user = await makeUser();
    await request(app).post(`/units/${unitId}/hold`).set("Authorization", `Bearer ${user.token}`);

    const confirms = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post(`/units/${unitId}/confirm-payment`)
          .set("Authorization", `Bearer ${user.token}`)
      )
    );
    const sold = confirms.filter((r) => r.status === 200);
    expect(sold).toHaveLength(1);

    const unit = await prisma.productUnit.findUnique({ where: { id: unitId } });
    expect(unit?.status).toBe("sold");
  });
});
