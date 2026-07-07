import { afterAll, beforeEach, describe, expect, test } from "@jest/globals";
import request from "supertest";
import { prisma } from "../src/prisma.js";
import { app, makeUser, resetDb, seedUnits } from "./helpers.js";

beforeEach(resetDb);
afterAll(async () => { await prisma.$disconnect(); });

describe("auth / authorization", () => {
  test("register then login returns tokens", async () => {
    const email = `auth_${Date.now()}@test.com`;
    const reg = await request(app).post("/auth/register").send({ email, password: "password123" });
    expect(reg.status).toBe(201);
    const login = await request(app).post("/auth/login").send({ email, password: "password123" });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.refreshToken).toBeTruthy();
  });

  test("duplicate register → 409", async () => {
    const email = `dup_${Date.now()}@test.com`;
    await request(app).post("/auth/register").send({ email, password: "password123" });
    const dup = await request(app).post("/auth/register").send({ email, password: "password123" });
    expect(dup.status).toBe(409);
  });

  test("wrong password → 401", async () => {
    const email = `wp_${Date.now()}@test.com`;
    await request(app).post("/auth/register").send({ email, password: "password123" });
    const login = await request(app).post("/auth/login").send({ email, password: "wrongpass1" });
    expect(login.status).toBe(401);
  });

  test("refresh rotates and revokes the old token", async () => {
    const { token: _t } = await makeUser();
    const email = `rot_${Date.now()}@test.com`;
    await request(app).post("/auth/register").send({ email, password: "password123" });
    const login = await request(app).post("/auth/login").send({ email, password: "password123" });
    const oldRt = login.body.refreshToken;

    const refreshed = await request(app).post("/auth/refresh").send({ refreshToken: oldRt });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).not.toBe(oldRt);

    const reuse = await request(app).post("/auth/refresh").send({ refreshToken: oldRt });
    expect(reuse.status).toBe(401);
  });

  test("logout revokes refresh token", async () => {
    const email = `lo_${Date.now()}@test.com`;
    await request(app).post("/auth/register").send({ email, password: "password123" });
    const login = await request(app).post("/auth/login").send({ email, password: "password123" });
    const rt = login.body.refreshToken;
    await request(app).post("/auth/logout").send({ refreshToken: rt });
    const after = await request(app).post("/auth/refresh").send({ refreshToken: rt });
    expect(after.status).toBe(401);
  });

  test("unauthenticated cannot hold", async () => {
    const [unitId] = await seedUnits(1);
    const res = await request(app).post(`/units/${unitId}/hold`);
    expect(res.status).toBe(401);
  });

  test("unauthenticated cannot confirm payment", async () => {
    const [unitId] = await seedUnits(1);
    const res = await request(app).post(`/units/${unitId}/confirm-payment`);
    expect(res.status).toBe(401);
  });
});
