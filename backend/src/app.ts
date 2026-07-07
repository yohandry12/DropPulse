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

export function createApp() {
  const app = express();
  app.use(express.json());

  // Request logger — one coloured line per request (method, path, status, ms).
  // Timed from receipt to response finish.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logRequest(req.method, req.originalUrl, res.statusCode, Date.now() - start);
    });
    next();
  });

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

  return app;
}
