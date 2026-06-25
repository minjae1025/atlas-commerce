import type { Request, Response } from "express";
import { z } from "zod";
import type { PaymentReadService } from "../domain/paymentReadService.js";
import type { IntentStatus } from "../types.js";
import { paginationQuerySchema, parseParams, parseQuery } from "./httpValidation.js";

const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const intentStatusSchema = z.enum([
  "requires_capture",
  "processing",
  "succeeded",
  "failed",
  "voided",
]);

const intentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const intentListQuerySchema = paginationQuerySchema.extend({
  status: intentStatusSchema.optional(),
  orderId: z.string().uuid().optional(),
  currency: currencySchema.optional(),
});

export function paymentReadController(reads: PaymentReadService) {
  return {
    async listIntents(req: Request, res: Response) {
      const query = parseQuery(intentListQuerySchema, req);
      const filter: { status?: IntentStatus; orderId?: string; currency?: string } = {};
      if (query.status !== undefined) filter.status = query.status;
      if (query.orderId !== undefined) filter.orderId = query.orderId;
      if (query.currency !== undefined) filter.currency = query.currency;
      const result = await reads.listIntents(filter, {
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json(result);
    },

    async listAttempts(req: Request, res: Response) {
      const params = parseParams(intentIdParamsSchema, req);
      const query = parseQuery(paginationQuerySchema, req);
      const result = await reads.listAttempts(params.id, {
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json(result);
    },

    async captureSummary(req: Request, res: Response) {
      const params = parseParams(intentIdParamsSchema, req);
      const result = await reads.getCaptureSummary(params.id);
      res.status(200).json(result);
    },
  };
}
