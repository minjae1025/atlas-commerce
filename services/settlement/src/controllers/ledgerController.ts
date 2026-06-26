import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "@atlas/shared";
import type { LedgerRepo } from "../repositories/ledgerRepo.js";
import { dateOnlySchema } from "./httpValidation.js";

const entrySchema = z.object({
  account: z.string().min(1).max(100),
  orderId: z.string().uuid().optional(),
  paymentIntentId: z.string().uuid().optional(),
  amountCents: z.number().int().refine(Number.isSafeInteger, "amountCents must be a safe integer"),
  currency: z.string().length(3),
  entryType: z.enum(["charge", "refund", "fee", "payout"]),
  externalRef: z.string().min(1).max(200).optional(),
});

export function ledgerController(ledger: LedgerRepo) {
  return {
    async createEntry(req: Request, res: Response) {
      const parsed = entrySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((i) => i.message).join("; "));
      }
      const { entry, created } = await ledger.insert(parsed.data);
      res.status(created ? 201 : 200).json(entry);
    },

    async dailyReport(req: Request, res: Response) {
      const date = String(req.query.date ?? "");
      const parsed = dateOnlySchema.safeParse(date);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((i) => i.message).join("; "));
      }
      const rows = await ledger.dailyReport(parsed.data);
      res.status(200).json({ date: parsed.data, totals: rows });
    },
  };
}
