import type { Request, Response } from "express";
import { z } from "zod";
import type { SettlementReadService } from "../domain/settlementReadService.js";
import { paginationQuerySchema, parseParams, parseQuery } from "./httpValidation.js";

const settlementParamsSchema = z.object({
  id: z.string().uuid(),
});

const settlementLineParamsSchema = z.object({
  id: z.string().uuid(),
  lineId: z.string().uuid(),
});

export function settlementReadController(reads: SettlementReadService) {
  return {
    async listLines(req: Request, res: Response) {
      const params = parseParams(settlementParamsSchema, req);
      const query = parseQuery(paginationQuerySchema, req);
      const result = await reads.listLines(params.id, {
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json(result);
    },

    async getLine(req: Request, res: Response) {
      const params = parseParams(settlementLineParamsSchema, req);
      const result = await reads.getLine(params.id, params.lineId);
      res.status(200).json(result);
    },
  };
}
