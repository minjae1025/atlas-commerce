import { withRetry, type Logger } from "@atlas/shared";
import { nextAttemptAt } from "../domain/backoff.js";
import type { WebhookClient } from "../clients/webhookClient.js";
import type { notificationDeliveryRepository } from "../repositories/notificationDeliveryRepository.js";

type DeliveryRepository = ReturnType<typeof notificationDeliveryRepository>;

export interface DeliveryWorkerConfig {
  pollMs: number;
  batchSize: number;
  maxAttempts: number;
  leaseMs?: number;
}

export function createDeliveryWorker(deps: {
  deliveries: DeliveryRepository;
  webhookClient: WebhookClient;
  logger: Logger;
  config: DeliveryWorkerConfig;
}) {
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  const leaseMs = deps.config.leaseMs ?? 5 * 60_000;

  const tick = async (): Promise<void> => {
    if (running) {
      return;
    }
    running = true;
    try {
      const leaseUntil = new Date(Date.now() + leaseMs);
      const deliveries = await deps.deliveries.claimDueForProcessing({
        limit: deps.config.batchSize,
        maxAttempts: deps.config.maxAttempts,
        leaseUntil
      });
      for (const delivery of deliveries) {
        if (!delivery.endpoint.active) {
          await deps.deliveries.failPermanently(delivery.id, "webhook endpoint is inactive");
          continue;
        }
        try {
          await withRetry(() => deps.webhookClient.send(delivery.endpoint, delivery), {
            retries: 2,
            baseDelayMs: 100
          });
          await deps.deliveries.markDelivered(delivery.id);
        } catch (error) {
          const attemptsAfterFailure = delivery.attempts + 1;
          const retryAt =
            attemptsAfterFailure >= deps.config.maxAttempts ? null : nextAttemptAt(new Date(), attemptsAfterFailure);
          const message = error instanceof Error ? error.message : String(error);
          await deps.deliveries.recordFailure({
            id: delivery.id,
            error: message,
            maxAttempts: deps.config.maxAttempts,
            nextAttemptAt: retryAt
          });
          deps.logger.warn("notification delivery failed", {
            deliveryId: delivery.id,
            endpointId: delivery.endpointId,
            attemptsAfterFailure,
            retryAt: retryAt?.toISOString() ?? null,
            error: message
          });
        }
      }
    } catch (error) {
      deps.logger.error("notification delivery worker tick failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      running = false;
    }
  };

  return {
    start() {
      if (timer) {
        return;
      }
      timer = setInterval(() => void tick(), deps.config.pollMs);
      void tick();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    tick
  };
}

export type DeliveryWorker = ReturnType<typeof createDeliveryWorker>;
