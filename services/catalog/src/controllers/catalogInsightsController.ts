import type { RequestHandler } from "express";
import type { Currency } from "../domain/currency.js";
import type { CatalogInsightsService } from "../domain/catalogInsightsService.js";
import type { PriceHistoryQuery, ProductSearchQuery } from "../domain/catalogInsightsTypes.js";
import { asyncHandler } from "./asyncHandler.js";
import {
  priceHistoryParamsSchema,
  priceHistoryQuerySchema,
  productSearchQuerySchema
} from "./catalogInsightsSchemas.js";
import { parseWithSchema } from "./validation.js";

export interface CatalogInsightsController {
  searchProducts: RequestHandler;
  categoryTree: RequestHandler;
  priceHistory: RequestHandler;
}

export function createCatalogInsightsController(
  insights: CatalogInsightsService
): CatalogInsightsController {
  return {
    searchProducts: asyncHandler(async (req, res) => {
      const query = parseWithSchema(productSearchQuerySchema, req.query, "query");
      const searchQuery: ProductSearchQuery = {
        sort: query.sort ?? "relevance",
        limit: query.limit ?? 50,
        offset: query.offset ?? 0
      };
      if (query.q !== undefined) {
        searchQuery.q = query.q;
      }
      if (query.categoryId !== undefined) {
        searchQuery.categoryId = query.categoryId;
      }
      if (query.status !== undefined) {
        searchQuery.status = query.status;
      }
      if (query.sku !== undefined) {
        searchQuery.sku = query.sku;
      }
      if (query.minPriceCents !== undefined) {
        searchQuery.minPriceCents = query.minPriceCents;
      }
      if (query.maxPriceCents !== undefined) {
        searchQuery.maxPriceCents = query.maxPriceCents;
      }
      res.json(await insights.searchProducts(searchQuery));
    }),

    categoryTree: asyncHandler(async (_req, res) => {
      res.json({ items: await insights.listCategoryTree() });
    }),

    priceHistory: asyncHandler(async (req, res) => {
      const params = parseWithSchema(priceHistoryParamsSchema, req.params, "params");
      const query = parseWithSchema(priceHistoryQuerySchema, req.query, "query");
      const historyQuery: PriceHistoryQuery = {
        productId: params.id,
        customerTier: query.customerTier ?? "standard",
        qty: query.qty ?? 1
      };
      if (query.currency !== undefined) {
        historyQuery.currency = query.currency as Currency;
      }
      if (req.id !== undefined) {
        historyQuery.requestId = req.id;
      }
      res.json(await insights.getPriceHistory(historyQuery));
    })
  };
}
