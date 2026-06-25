import type { Request, Response } from "express";
import { z } from "zod";
import type { LedgerReadService } from "../domain/ledgerReadService.js";
import { dateOnlySchema, parseParams, parseQuery } from "./httpValidation.js";

const currencySchema = z.string().regex(/^[A-Z]{3}$/);

const accountParamsSchema = z.object({
  account: z.string().min(1).max(100),
});

const balanceQuerySchema = z.object({
  currency: currencySchema.optional(),
});

const periodReportQuerySchema = z.object({
  periodStart: dateOnlySchema,
  periodEnd: dateOnlySchema,
  bucket: z.enum(["day", "week", "month"]).default("week"),
});

export function ledgerReadController(reads: LedgerReadService) {
  return {
    async accountBalance(req: Request, res: Response) {
      const params = parseParams(accountParamsSchema, req);
      const query = parseQuery(balanceQuerySchema, req);
      const result = await reads.getAccountBalance(params.account, query.currency);
      res.status(200).json(result);
    },

    async periodReport(req: Request, res: Response) {
      const query = parseQuery(periodReportQuerySchema, req);
      const result = await reads.periodReport(query.periodStart, query.periodEnd, query.bucket);
      res.status(200).json(result);
    },
  };
}
