import { defineConfig } from "@atlas/shared";

export interface ReturnsConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  ordersUrl: string;
  inventoryUrl: string;
  settlementUrl: string;
  serviceTimeoutMs: number;
}

const parsePositiveInt = (name: string) => (raw: string): number => {
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${name} value: ${raw}`);
  }
  return value;
};

export function loadConfig(): ReturnsConfig {
  return defineConfig<ReturnsConfig>({
    port: { env: "PORT", default: "7007", parse: parsePositiveInt("PORT") },
    databaseUrl: { env: "DATABASE_URL", required: true },
    redisUrl: { env: "REDIS_URL", required: true },
    ordersUrl: { env: "ORDERS_URL", default: "http://orders:7004" },
    inventoryUrl: { env: "INVENTORY_URL", default: "http://inventory:7003" },
    settlementUrl: { env: "SETTLEMENT_URL", default: "http://settlement:7006" },
    serviceTimeoutMs: {
      env: "SERVICE_TIMEOUT_MS",
      default: "2000",
      parse: parsePositiveInt("SERVICE_TIMEOUT_MS")
    }
  });
}
