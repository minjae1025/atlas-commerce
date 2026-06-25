import { Router } from "express";
import type { CreateAppDeps } from "../app.js";
import {
  addOrderNoteController,
  exportOrdersController,
  shipmentSlaController
} from "../controllers/orderOperationsController.js";
import { OrderOperationsService } from "../domain/orderOperationsService.js";
import { OrderOperationsRepository } from "../repositories/orderOperationsRepository.js";

export const orderOperationsRoutes = (deps: CreateAppDeps): Router => {
  const router = Router();
  const service = new OrderOperationsService(
    new OrderOperationsRepository(deps.db, deps.cache),
    deps.cache,
    deps.logger
  );

  router.get("/orders/export", exportOrdersController(service));
  router.get("/orders/shipping-sla", shipmentSlaController(service));
  router.post("/orders/:id/notes", addOrderNoteController(service));

  return router;
};
