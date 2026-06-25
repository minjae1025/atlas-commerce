import { z } from "zod";

const uuid = z.string().uuid();

export const transferStockBodySchema = z.object({
  transferId: uuid.optional(),
  sourceWarehouseId: uuid,
  destinationWarehouseId: uuid,
  productId: uuid,
  qty: z.coerce.number().int().min(1).max(10_000),
  reason: z.string().trim().min(1).max(200).default("warehouse_transfer")
});

export const lowStockQuerySchema = z.object({
  warehouseId: uuid.optional(),
  threshold: z.coerce.number().int().min(0).max(1000).default(10),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0)
});

export const cycleCountBodySchema = z.object({
  cycleCountId: uuid.optional(),
  warehouseId: uuid,
  productId: uuid,
  countedOnHand: z.coerce.number().int().min(0).max(1_000_000),
  countedBy: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(200).default("cycle_count")
});
