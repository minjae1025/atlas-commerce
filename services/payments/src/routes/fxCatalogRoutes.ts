import { Router } from "express";
import type { fxCatalogController } from "../controllers/fxCatalogController.js";

export function fxCatalogRoutes(controller: ReturnType<typeof fxCatalogController>): Router {
  const router = Router();
  router.get("/fx", (req, res, next) => controller.listRates(req, res).catch(next));
  return router;
}
