import {
  createCache,
  createIdempotency,
  createLogger,
  createPool,
  serviceClient
} from "@atlas/shared";
import { createInventoryClient } from "./clients/inventoryClient.js";
import { createOrdersClient } from "./clients/ordersClient.js";
import { createSettlementClient } from "./clients/settlementClient.js";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const config = loadConfig();
const logger = createLogger("returns");
const db = createPool({ connectionString: config.databaseUrl, schema: "returns" });
const cache = createCache({ url: config.redisUrl, prefix: "returns" });
const idempotency = createIdempotency(cache);

const orders = createOrdersClient(
  serviceClient({ baseUrl: config.ordersUrl, service: "orders", timeoutMs: config.serviceTimeoutMs }),
  logger
);
const inventory = createInventoryClient(
  serviceClient({
    baseUrl: config.inventoryUrl,
    service: "inventory",
    timeoutMs: config.serviceTimeoutMs
  }),
  logger
);
const settlement = createSettlementClient(
  serviceClient({
    baseUrl: config.settlementUrl,
    service: "settlement",
    timeoutMs: config.serviceTimeoutMs
  }),
  logger
);

const app = createApp({ db, cache, logger, idempotency, orders, inventory, settlement });

const server = app.listen(config.port, () => {
  logger.info("returns listening", { port: config.port });
});

async function shutdown(signal: string) {
  logger.info("shutting down", { signal });
  server.close(async () => {
    await db.close();
    await cache.close();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
