import { z } from "zod";
import { isSupportedCurrency, normalizeCurrency } from "../domain/currency.js";

const uuid = z.string().uuid();
const currencySchema = z
  .string()
  .trim()
  .length(3)
  .transform(normalizeCurrency)
  .refine(isSupportedCurrency, "unsupported currency");

export const productSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(160).optional(),
  categoryId: uuid.optional(),
  status: z.enum(["active", "discontinued"]).optional(),
  sku: z.string().trim().min(1).max(80).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc", "updated_desc"]).default("relevance"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
}).refine(
  (value) =>
    value.minPriceCents === undefined ||
    value.maxPriceCents === undefined ||
    value.minPriceCents <= value.maxPriceCents,
  "minPriceCents must be less than or equal to maxPriceCents"
);

export const priceHistoryParamsSchema = z.object({
  id: uuid
});

export const priceHistoryQuerySchema = z.object({
  customerTier: z.enum(["standard", "gold", "platinum"]).default("standard"),
  currency: currencySchema.optional(),
  qty: z.coerce.number().int().min(1).max(1000).default(1)
});
