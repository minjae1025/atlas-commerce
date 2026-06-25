import type { Request, Response } from "express";
import { z } from "zod";
import type { FxCatalogService } from "../domain/fxCatalogService.js";
import { paginationQuerySchema, parseQuery } from "./httpValidation.js";

const fxListQuerySchema = paginationQuerySchema.extend({
  base: z.string().regex(/^[A-Z]{3}$/).optional(),
  quote: z.string().regex(/^[A-Z]{3}$/).optional(),
});

export function fxCatalogController(fx: FxCatalogService) {
  return {
    async listRates(req: Request, res: Response) {
      const query = parseQuery(fxListQuerySchema, req);
      const filter: { base?: string; quote?: string } = {};
      if (query.base !== undefined) filter.base = query.base;
      if (query.quote !== undefined) filter.quote = query.quote;
      const result = await fx.listRates(filter, {
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json(result);
    },
  };
}
