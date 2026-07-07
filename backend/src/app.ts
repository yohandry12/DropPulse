import "./loadEnv.js";
import express from "express";
import { logRequest } from "./logger.js";
import { authRouter } from "./auth/routes.js";
import { dropperRouter } from "./dropper/routes.js";
import { adminUsersRouter } from "./admin/users.js";
import { adminProductsRouter } from "./admin/products.js";
import { adminStatsRouter } from "./admin/stats.js";
import { productRouter, unitRouter } from "./units/routes.js";
import { uploadRouter } from "./uploads/routes.js";
import { notificationRouter } from "./notifications/routes.js";
import { paymentRouter } from "./payments/routes.js";

export function createApp() {
  const app = express();

  // Request logger first — one coloured line per request (method, path, status,
  // ms), timed from receipt to response finish. Before body parsing so every
  // request (including the raw-body Stripe webhook) is logged.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logRequest(req.method, req.originalUrl, res.statusCode, Date.now() - start);
    });
    next();
  });

  // Payments mounted BEFORE express.json(): the Stripe webhook needs the raw
  // request body for signature verification (its route uses express.raw()), and
  // a global json() parser would consume the stream first. The checkout route
  // reads only params/auth, no JSON body, so it's unaffected by the ordering.
  app.use(paymentRouter);

  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/products", productRouter);
  app.use("/units", unitRouter);
  // Mounted at root: its route paths carry the full /dropper-requests and
  // /admin/dropper-requests prefixes themselves.
  app.use(dropperRouter);
  app.use(adminUsersRouter);
  app.use(adminProductsRouter);
  app.use(adminStatsRouter);
  app.use(uploadRouter);
  // Mounted at root: routes carry their own /notifications prefix.
  app.use(notificationRouter);

  return app;
}
