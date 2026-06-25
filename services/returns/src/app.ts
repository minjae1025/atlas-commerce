import express from "express";
import {
  accessLog,
  errorHandler,
  healthRouter,
  requestId,
  type Cache,
  type Db,
  type Idempotency,
  type Logger
} from "@atlas/shared";
import type { OrdersClient } from "./clients/ordersClient.js";
import type { InventoryClient } from "./clients/inventoryClient.js";
import type { SettlementClient } from "./clients/settlementClient.js";
import { returnsController } from "./controllers/returnsController.js";
import { returnsRepo } from "./repositories/returnsRepo.js";
import { returnsRoutes } from "./routes/returnsRoutes.js";

export interface AppDeps {
  db: Db;
  cache: Cache;
  logger: Logger;
  idempotency: Idempotency;
  orders: OrdersClient;
  inventory: InventoryClient;
  settlement: SettlementClient;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.use(express.json());
  app.use(requestId());
  app.use(accessLog(deps.logger));

  const serviceDeps = {
    returns: returnsRepo(deps.db),
    orders: deps.orders,
    inventory: deps.inventory,
    settlement: deps.settlement,
    idempotency: deps.idempotency
  };

  app.use(
    healthRouter([
      { name: "postgres", check: async () => { await deps.db.query("SELECT 1"); } },
      { name: "redis", check: async () => { await deps.cache.set("returns:ready-probe", 1, 5); } },
      { name: "orders", check: async () => { await deps.orders.checkReady({}); } },
      { name: "inventory", check: async () => { await deps.inventory.checkReady({}); } },
      { name: "settlement", check: async () => { await deps.settlement.checkReady({}); } }
    ])
  );
  app.use("/returns", returnsRoutes(returnsController(serviceDeps)));
  app.use(errorHandler(deps.logger));
  return app;
}
