import { defineConfig } from "@atlas/shared";

export interface NotificationsConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  logLevel: string;
  workerEnabled: boolean;
  deliveryPollMs: number;
  deliveryBatchSize: number;
  deliveryMaxAttempts: number;
  webhookTimeoutMs: number;
}

const parseBool = (raw: string): boolean => raw === "true" || raw === "1";
const parseIntValue = (raw: string): number => Number.parseInt(raw, 10);

export function loadConfig(): NotificationsConfig {
  return defineConfig<NotificationsConfig>({
    port: { env: "PORT", default: "7008", parse: parseIntValue },
    databaseUrl: { env: "DATABASE_URL", required: true },
    redisUrl: { env: "REDIS_URL", required: true },
    logLevel: { env: "LOG_LEVEL", default: "info" },
    workerEnabled: { env: "NOTIFICATIONS_WORKER_ENABLED", default: "true", parse: parseBool },
    deliveryPollMs: { env: "NOTIFICATIONS_DELIVERY_POLL_MS", default: "1000", parse: parseIntValue },
    deliveryBatchSize: { env: "NOTIFICATIONS_DELIVERY_BATCH_SIZE", default: "25", parse: parseIntValue },
    deliveryMaxAttempts: { env: "NOTIFICATIONS_DELIVERY_MAX_ATTEMPTS", default: "5", parse: parseIntValue },
    webhookTimeoutMs: { env: "NOTIFICATIONS_WEBHOOK_TIMEOUT_MS", default: "2500", parse: parseIntValue }
  });
}
