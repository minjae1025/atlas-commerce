import { Router } from "express";
import type { InventoryDeps } from "../deps.js";
import {
  cycleCountController,
  lowStockController,
  transferStockController
} from "../controllers/stockOperationsController.js";
import { StockOperationsService } from "../domain/stockOperationsService.js";
import { StockOperationsRepository } from "../repositories/stockOperationsRepository.js";

export const stockOperationsRoutes = (deps: InventoryDeps): Router => {
  const router = Router();
  const service = new StockOperationsService(
    new StockOperationsRepository(deps.db),
    deps.cache,
    deps.logger
  );

  router.post("/transfers", transferStockController(service));
  router.get("/low-stock", lowStockController(service));
  router.post("/cycle-counts", cycleCountController(service));

  return router;
};
