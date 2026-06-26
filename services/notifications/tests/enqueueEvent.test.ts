import { describe, expect, it } from "vitest";
import { enqueueNotificationEvent } from "../src/domain/enqueueEvent.js";
import type { WebhookEndpoint } from "../src/domain/types.js";
import { createMemoryIdempotency } from "./memoryCache.js";

function endpoint(overrides: Partial<WebhookEndpoint> = {}): WebhookEndpoint {
  return {
    id: "0b5a9295-9f34-41fb-9e19-8c9c72a00b30",
    customerId: "bd8bf571-7aa1-454b-8b41-57cc90c263da",
    url: "https://customer.example/webhooks",
    eventTypes: ["order.confirmed"],
    secret: "top-secret",
    active: true,
    createdAt: "2026-06-15T00:00:00.000Z",
    ...overrides
  };
}

describe("enqueueNotificationEvent", () => {
  it("creates one pending delivery for every matching endpoint", async () => {
    const deliveries: { endpointId: string; eventType: string; payload: unknown }[] = [];
    const result = await enqueueNotificationEvent(
      {
        endpoints: {
          findActiveByEventType: async () => [
            endpoint({ id: "0b5a9295-9f34-41fb-9e19-8c9c72a00b30" }),
            endpoint({ id: "f38a84de-9700-4915-893c-f50910016a3c" })
          ]
        },
        deliveries: {
          enqueue: async (input) => {
            deliveries.push(...input);
            return input.length;
          }
        },
        idempotency: createMemoryIdempotency()
      },
      { eventType: "order.confirmed", payload: { orderId: "ord_100" } }
    );

    expect(result).toEqual({ enqueued: 2, replayed: false });
    expect(deliveries.map((delivery) => delivery.endpointId)).toEqual([
      "0b5a9295-9f34-41fb-9e19-8c9c72a00b30",
      "f38a84de-9700-4915-893c-f50910016a3c"
    ]);
  });

  it("replays duplicate event enqueue calls without creating more rows", async () => {
    const idempotency = createMemoryIdempotency();
    let inserts = 0;
    const deps = {
      endpoints: {
        findActiveByEventType: async () => [endpoint()]
      },
      deliveries: {
        enqueue: async (input: { endpointId: string; eventType: string; payload: unknown }[]) => {
          inserts += input.length;
          return input.length;
        }
      },
      idempotency
    };
    const event = { eventType: "order.confirmed", payload: { orderId: "ord_100", totalCents: 1000 } };

    const first = await enqueueNotificationEvent(deps, event);
    const second = await enqueueNotificationEvent(deps, event);

    expect(first).toEqual({ enqueued: 1, replayed: false });
    expect(second).toEqual({ enqueued: 1, replayed: true });
    expect(inserts).toBe(1);
  });
});
