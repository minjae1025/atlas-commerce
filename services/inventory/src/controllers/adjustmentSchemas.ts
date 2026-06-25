import { z } from "zod";

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

export const createAdjustmentBodySchema = z.object({
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  delta: z.number().int().min(INT32_MIN).max(INT32_MAX).refine((value) => value !== 0, "delta must be non-zero"),
  reason: z.string().trim().min(1).max(120)
});
