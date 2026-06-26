import type { Idempotency } from "@atlas/shared";
import { eventIdempotencyKey } from "./eventIdentity.js";
import type { WebhookEndpoint } from "./types.js";

export interface EndpointLookup {
  findActiveByEventType(eventType: string): Promise<WebhookEndpoint[]>;
}

export interface DeliveryEnqueue {
  enqueue(input: { endpointId: string; eventType: string; payload: unknown }[]): Promise<number>;
}

export interface EnqueueNotificationEventDeps {
  endpoints: EndpointLookup;
  deliveries: DeliveryEnqueue;
  idempotency: Idempotency;
  ttlSec?: number;
}

export interface EnqueueNotificationEventInput {
  eventType: string;
  payload: unknown;
}

export async function enqueueNotificationEvent(
  deps: EnqueueNotificationEventDeps,
  input: EnqueueNotificationEventInput
): Promise<{ enqueued: number; replayed: boolean }> {
  const key = eventIdempotencyKey(input.eventType, input.payload);
  const { result, replayed } = await deps.idempotency.run(key, deps.ttlSec ?? 86_400, async () => {
    const endpoints = await deps.endpoints.findActiveByEventType(input.eventType);
    const enqueued = await deps.deliveries.enqueue(
      endpoints.map((endpoint) => ({
        endpointId: endpoint.id,
        eventType: input.eventType,
        payload: input.payload
      }))
    );
    return { enqueued };
  });
  return { ...result, replayed };
}
