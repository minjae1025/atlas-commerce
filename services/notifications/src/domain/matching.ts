import type { WebhookEndpoint } from "./types.js";

export function endpointMatchesEvent(endpoint: Pick<WebhookEndpoint, "active" | "eventTypes">, eventType: string): boolean {
  return endpoint.active && endpoint.eventTypes.includes(eventType);
}

export function matchingEndpoints<T extends Pick<WebhookEndpoint, "active" | "eventTypes">>(
  endpoints: T[],
  eventType: string
): T[] {
  return endpoints.filter((endpoint) => endpointMatchesEvent(endpoint, eventType));
}
