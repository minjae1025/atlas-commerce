import { z } from "zod";
import { returnStatuses } from "../domain/models.js";

const uuid = z.string().uuid();

export const createReturnBodySchema = z.object({
  orderId: uuid,
  lines: z
    .array(
      z.object({
        productId: uuid,
        qty: z.number().int().min(1)
      })
    )
    .min(1),
  reason: z.string().trim().min(1).max(500)
});

export const returnIdParamsSchema = z.object({
  id: uuid
});

export const listReturnsQuerySchema = z.object({
  orderId: uuid.optional(),
  customerId: uuid.optional(),
  status: z.enum(returnStatuses).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const rejectReturnBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional()
  })
  .default({});
