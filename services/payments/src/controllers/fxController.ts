import type { Request, Response } from "express";
import { z } from "zod";
import type { FxService } from "../domain/fxService.js";
import { parseParams } from "./httpValidation.js";

const currencyParamsSchema = z.object({
  base: z.string().regex(/^[A-Z]{3}$/),
  quote: z.string().regex(/^[A-Z]{3}$/)
});

export function fxController(fx: FxService) {
  return {
    async getRate(req: Request, res: Response) {
      const params = parseParams(currencyParamsSchema, req);
      const rate = await fx.getRate(params.base, params.quote);
      res.status(200).json(rate);
    },
  };
}
