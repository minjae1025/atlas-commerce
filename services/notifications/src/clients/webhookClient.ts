import { createHmac } from "node:crypto";
import type { ClaimedDelivery, WebhookEndpoint } from "../domain/types.js";

export interface WebhookClient {
  send(endpoint: WebhookEndpoint, delivery: ClaimedDelivery): Promise<void>;
}

export function createWebhookClient(config: { timeoutMs: number }): WebhookClient {
  return {
    async send(endpoint, delivery) {
      const body = JSON.stringify({
        deliveryId: delivery.id,
        eventType: delivery.eventType,
        payload: delivery.payload
      });
      const signature = endpoint.secret
        ? createHmac("sha256", endpoint.secret).update(body).digest("hex")
        : null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-atlas-delivery-id": delivery.id,
            "x-atlas-event-type": delivery.eventType,
            ...(signature ? { "x-atlas-signature": `sha256=${signature}` } : {})
          },
          body,
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(`webhook responded with ${response.status}`);
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
