import express from "express";
import {
  accessLog,
  errorHandler,
  healthRouter,
  requestId,
  type Cache,
  type Db,
  type Logger
} from "@atlas/shared";
import { notificationsController } from "./controllers/notificationsController.js";
import { createNotificationServices } from "./deps.js";
import { notificationsRoutes } from "./routes/notificationsRoutes.js";

export interface AppDeps {
  db: Db;
  cache: Cache;
  logger: Logger;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  const services = createNotificationServices(deps);

  app.use(express.json({ limit: "1mb" }));
  app.use(requestId());
  app.use(accessLog(deps.logger));
  app.use(
    healthRouter([
      { name: "postgres", check: async () => { await deps.db.query("SELECT 1"); } },
      { name: "redis", check: async () => { await deps.cache.set("notifications:ready-probe", 1, 5); } }
    ])
  );
  app.use(notificationsRoutes(notificationsController(services.notifications)));
  app.use(errorHandler(deps.logger));
  return app;
}
