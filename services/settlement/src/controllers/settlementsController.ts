import type { Request, Response } from "express";
import { z } from "zod";
import { NotFoundError, ValidationError } from "@atlas/shared";
import type { SettlementsRepo } from "../repositories/settlementsRepo.js";
import { dateOnlySchema, parseParams } from "./httpValidation.js";

const runSchema = z.object({
  periodStart: dateOnlySchema,
  periodEnd: dateOnlySchema,
});

const settlementIdParamsSchema = z.object({ id: z.string().uuid() });

export function settlementsController(settlements: SettlementsRepo) {
  return {
    async run(req: Request, res: Response) {
      const parsed = runSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((i) => i.message).join("; "));
      }
      if (parsed.data.periodEnd < parsed.data.periodStart) {
        throw new ValidationError("periodEnd must not precede periodStart");
      }
      const settlement = await settlements.runDraft(parsed.data.periodStart, parsed.data.periodEnd);
      res.status(201).json(settlement);
    },

    async getById(req: Request, res: Response) {
      const params = parseParams(settlementIdParamsSchema, req);
      const settlement = await settlements.findById(params.id);
      if (!settlement) throw new NotFoundError("settlement not found");
      res.status(200).json(settlement);
    },
  };
}
