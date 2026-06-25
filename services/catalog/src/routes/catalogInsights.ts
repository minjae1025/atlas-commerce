import { Router } from "express";
import type { CatalogServices } from "../deps.js";
import { createCatalogInsightsController } from "../controllers/catalogInsightsController.js";
import { CatalogInsightsService } from "../domain/catalogInsightsService.js";
import { CatalogInsightsRepository } from "../repositories/catalogInsightsRepository.js";
import { createLogger } from "@atlas/shared";

export function createCatalogInsightsRouter(services: CatalogServices): Router {
  const router = Router();
  const repository = new CatalogInsightsRepository(services);
  const insights = createCatalogInsightsController(
    new CatalogInsightsService(repository, createLogger("catalog-insights"))
  );

  router.get("/products/search", insights.searchProducts);
  router.get("/products/:id/price-history", insights.priceHistory);
  router.get("/categories/tree", insights.categoryTree);

  return router;
}
