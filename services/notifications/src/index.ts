import { createCache, createLogger, createPool } from "@atlas/shared";
import { createApp } from "./app.js";
import { createWebhookClient } from "./clients/webhookClient.js";
import { loadConfig } from "./config.js";
import { createNotificationServices } from "./deps.js";
import { createDeliveryWorker } from "./jobs/deliveryWorker.js";

const config = loadConfig();
const logger = createLogger("notifications");
const db = createPool({ connectionString: config.databaseUrl, schema: "notifications" });
const cache = createCache({ url: config.redisUrl, prefix: "notifications" });

const app = createApp({ db, cache, logger });
const services = createNotificationServices({ db, cache, logger });
const worker = config.workerEnabled
  ? createDeliveryWorker({
      deliveries: services.deliveries,
      webhookClient: createWebhookClient({ timeoutMs: config.webhookTimeoutMs }),
      logger,
      config: {
        pollMs: config.deliveryPollMs,
        batchSize: config.deliveryBatchSize,
        maxAttempts: config.deliveryMaxAttempts
      }
    })
  : null;

const server = app.listen(config.port, () => {
  logger.info("notifications listening", { port: config.port });
  worker?.start();
});

async function shutdown(signal: string) {
  logger.info("shutting down", { signal });
  worker?.stop();
  server.close(async () => {
    await db.close();
    await cache.close();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
