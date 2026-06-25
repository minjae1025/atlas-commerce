export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface WebhookEndpoint {
  id: string;
  customerId: string;
  url: string;
  eventTypes: string[];
  secret: string | null;
  active: boolean;
  createdAt: string;
}

export interface NotificationDelivery {
  id: string;
  endpointId: string;
  eventType: string;
  payload: unknown;
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimedDelivery extends NotificationDelivery {
  endpoint: WebhookEndpoint;
}

export interface ListResult<T> {
  items: T[];
  total: number;
}
