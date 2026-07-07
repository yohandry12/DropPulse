// Load the test env BEFORE anything imports config/prisma.
process.loadEnvFile(".env.test");

import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

export const app: Express = createApp();

export async function resetDb(): Promise<void> {
  // Order matters for FK constraints.
  await prisma.productUnit.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
}

let seq = 0;
export async function makeUser(): Promise<{ email: string; token: string; id: string }> {
  const email = `u${Date.now()}_${seq++}@test.com`;
  const reg = await request(app)
    .post("/auth/register")
    .send({ email, password: "password123", name: "Test User" });
  const login = await request(app)
    .post("/auth/login")
    .send({ email, password: "password123" });
  return { email, token: login.body.accessToken, id: reg.body.id };
}

// Create a product with N units. Optionally override each unit's fields
// (e.g. pre-expired holds) for expiration tests.
export async function seedUnits(
  count: number,
  status: "available" | "held" = "available"
): Promise<string[]> {
  const product = await prisma.product.create({
    data: {
      name: "Test Drop",
      price: 1000,
      units: {
        create: Array.from({ length: count }, (_, i) => ({
          serialNumber: `T-${Date.now()}-${seq++}-${i}`,
          status,
        })),
      },
    },
    include: { units: true },
  });
  return product.units.map((u) => u.id);
}
