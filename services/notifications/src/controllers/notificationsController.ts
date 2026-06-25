import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "@atlas/shared";
import type { DeliveryStatus } from "../domain/types.js";
import type { NotificationService } from "../domain/notificationService.js";

const createWebhookSchema = z.object({
  customerId: z.string().uuid(),
  url: z.string().url(),
  eventTypes: z.array(z.string().min(1).max(120)).min(1),
  secret: z.string().min(8).max(500).optional()
});

const eventSchema = z.object({
  eventType: z.string().min(1).max(120),
  payload: z.record(z.unknown())
});

const deliveryStatusSchema = z.enum(["pending", "delivered", "failed"]);
const uuidSchema = z.string().uuid();

function parseBooleanQuery(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new ValidationError("active must be true or false");
}

function parseUuidQuery(value: unknown, field: string): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError(`${field} must be a UUID`);
  }
  return parsed.data;
}

function parseUuidParam(value: unknown, field: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError(`${field} must be a UUID`);
  }
  return parsed.data;
}

function parseDeliveryStatus(value: unknown): DeliveryStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = deliveryStatusSchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError("status must be pending, delivered, or failed");
  }
  return parsed.data;
}

export function notificationsController(service: NotificationService) {
  return {
    async createWebhook(req: Request, res: Response) {
      const parsed = createWebhookSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
      }
      const endpoint = await service.createEndpoint({
        customerId: parsed.data.customerId,
        url: parsed.data.url,
        eventTypes: parsed.data.eventTypes,
        ...(parsed.data.secret === undefined ? {} : { secret: parsed.data.secret })
      });
      res.status(201).json(endpoint);
    },

    async listWebhooks(req: Request, res: Response) {
      const customerId = parseUuidQuery(req.query.customerId, "customerId");
      const active = parseBooleanQuery(req.query.active);
      const filters: { customerId?: string; active?: boolean } = {};
      if (customerId !== undefined) filters.customerId = customerId;
      if (active !== undefined) filters.active = active;
      const result = await service.listEndpoints(filters);
      res.status(200).json(result);
    },

    async getWebhook(req: Request, res: Response) {
      const id = parseUuidParam(req.params.id, "id");
      const endpoint = await service.getEndpoint(id);
      res.status(200).json(endpoint);
    },

    async deleteWebhook(req: Request, res: Response) {
      const id = parseUuidParam(req.params.id, "id");
      const endpoint = await service.deleteEndpoint(id);
      res.status(200).json(endpoint);
    },

    async publishEvent(req: Request, res: Response) {
      const parsed = eventSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
      }
      const result = await service.publishEvent(parsed.data);
      res.status(202).json({ enqueued: result.enqueued });
    },

    async listDeliveries(req: Request, res: Response) {
      const endpointId = parseUuidQuery(req.query.endpointId, "endpointId");
      const status = parseDeliveryStatus(req.query.status);
      const filters: { endpointId?: string; status?: DeliveryStatus } = {};
      if (endpointId !== undefined) filters.endpointId = endpointId;
      if (status !== undefined) filters.status = status;
      const result = await service.listDeliveries(filters);
      res.status(200).json(result);
    },

    async retryDelivery(req: Request, res: Response) {
      const id = parseUuidParam(req.params.id, "id");
      const delivery = await service.retryDelivery(id);
      res.status(202).json(delivery);
    }
  };
}
