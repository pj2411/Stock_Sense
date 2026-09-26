import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/error-handler";
import authRoutes from "./routes/auth.routes";
import catalogRoutes from "./routes/catalog.routes";
import inventoryRoutes from "./routes/inventory.routes";
import operationsRoutes from "./routes/operations.routes";
import { openapi } from "./docs/openapi";

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.APP_ORIGIN === "*" ? true : env.APP_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));
  app.use((req, _res, next) => { if (env.NODE_ENV !== "test") console.log(`${req.method} ${req.path}`); next(); });
  app.get("/health", (_req, res) => res.json({ success: true, data: { service: "stocksense-backend", status: "ok" } }));
  app.get("/api/v1/openapi.json", (_req, res) => res.json(openapi));
  app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(openapi));
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1", catalogRoutes);
  app.use("/api/v1", inventoryRoutes);
  app.use("/api/v1", operationsRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
