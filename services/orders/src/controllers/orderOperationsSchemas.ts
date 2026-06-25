import { z } from "zod";
import { orderStatuses } from "../domain/models.js";

const uuid = z.string().uuid();
const isoDateTime = z.string().datetime({ offset: true });

export const orderNoteParamsSchema = z.object({
  id: uuid
});

export const addOrderNoteBodySchema = z.object({
  noteId: uuid.optional(),
  author: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  visibility: z.enum(["internal", "customer"]).default("internal")
});

export const orderExportQuerySchema = z.object({
  customerId: uuid.optional(),
  status: z.enum(orderStatuses).optional(),
  placedFrom: isoDateTime.optional(),
  placedTo: isoDateTime.optional(),
  format: z.enum(["json", "csv"]).default("json"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0)
}).refine(
  (value) =>
    value.placedFrom === undefined ||
    value.placedTo === undefined ||
    value.placedFrom <= value.placedTo,
  "placedFrom must be before placedTo"
);

export const shipmentSlaQuerySchema = z.object({
  targetMinutes: z.coerce.number().int().min(1).max(43_200).default(1440),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0)
});
