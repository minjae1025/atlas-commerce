import { createIdempotency, type Cache, type Db, type Logger } from "@atlas/shared";
import { notificationService } from "./domain/notificationService.js";
import { notificationDeliveryRepository } from "./repositories/notificationDeliveryRepository.js";
import { webhookEndpointRepository } from "./repositories/webhookEndpointRepository.js";

export interface NotificationDeps {
  db: Db;
  cache: Cache;
  logger: Logger;
}

export function createNotificationServices(deps: NotificationDeps) {
  const endpoints = webhookEndpointRepository(deps.db);
  const deliveries = notificationDeliveryRepository(deps.db);
  const idempotency = createIdempotency(deps.cache);
  const notifications = notificationService({ endpoints, deliveries, idempotency });
  return { endpoints, deliveries, notifications };
}

export type NotificationServices = ReturnType<typeof createNotificationServices>;
