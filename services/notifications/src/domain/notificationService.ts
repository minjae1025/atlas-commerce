import { NotFoundError, ValidationError, type Idempotency } from "@atlas/shared";
import { enqueueNotificationEvent, type DeliveryEnqueue, type EndpointLookup } from "./enqueueEvent.js";
import type { DeliveryStatus, ListResult, NotificationDelivery, WebhookEndpoint } from "./types.js";

export interface WebhookEndpointRepository extends EndpointLookup {
  create(input: {
    customerId: string;
    url: string;
    eventTypes: string[];
    secret?: string | null;
  }): Promise<WebhookEndpoint>;
  list(filters: { customerId?: string; active?: boolean }): Promise<ListResult<WebhookEndpoint>>;
  findById(id: string): Promise<WebhookEndpoint | null>;
  deactivate(id: string): Promise<WebhookEndpoint | null>;
}

export interface NotificationDeliveryRepository extends DeliveryEnqueue {
  list(filters: { endpointId?: string; status?: DeliveryStatus }): Promise<ListResult<NotificationDelivery>>;
  findById(id: string): Promise<NotificationDelivery | null>;
  requeueFailed(id: string): Promise<NotificationDelivery | null>;
}

export interface NotificationServiceDeps {
  endpoints: WebhookEndpointRepository;
  deliveries: NotificationDeliveryRepository;
  idempotency: Idempotency;
}

export function notificationService(deps: NotificationServiceDeps) {
  return {
    createEndpoint(input: {
      customerId: string;
      url: string;
      eventTypes: string[];
      secret?: string | null;
    }): Promise<WebhookEndpoint> {
      return deps.endpoints.create(input);
    },

    listEndpoints(filters: { customerId?: string; active?: boolean }): Promise<ListResult<WebhookEndpoint>> {
      return deps.endpoints.list(filters);
    },

    async getEndpoint(id: string): Promise<WebhookEndpoint> {
      const endpoint = await deps.endpoints.findById(id);
      if (!endpoint) {
        throw new NotFoundError("webhook endpoint not found", { endpointId: id });
      }
      return endpoint;
    },

    async deleteEndpoint(id: string): Promise<WebhookEndpoint> {
      const endpoint = await deps.endpoints.deactivate(id);
      if (!endpoint) {
        throw new NotFoundError("webhook endpoint not found", { endpointId: id });
      }
      return endpoint;
    },

    publishEvent(input: { eventType: string; payload: unknown }): Promise<{ enqueued: number; replayed: boolean }> {
      return enqueueNotificationEvent(
        {
          endpoints: deps.endpoints,
          deliveries: deps.deliveries,
          idempotency: deps.idempotency
        },
        input
      );
    },

    listDeliveries(filters: { endpointId?: string; status?: DeliveryStatus }): Promise<ListResult<NotificationDelivery>> {
      return deps.deliveries.list(filters);
    },

    async retryDelivery(id: string): Promise<NotificationDelivery> {
      const delivery = await deps.deliveries.findById(id);
      if (!delivery) {
        throw new NotFoundError("notification delivery not found", { deliveryId: id });
      }
      if (delivery.status !== "failed") {
        throw new ValidationError("only failed deliveries can be retried", { deliveryId: id, status: delivery.status });
      }
      const requeued = await deps.deliveries.requeueFailed(id);
      if (!requeued) {
        throw new ValidationError("delivery could not be requeued", { deliveryId: id });
      }
      return requeued;
    }
  };
}

export type NotificationService = ReturnType<typeof notificationService>;
