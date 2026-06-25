import { Router } from "express";
import type { providerController } from "../controllers/providerController.js";

export function providerRoutes(controller: ReturnType<typeof providerController>): Router {
  const router = Router();
  router.get("/provider", (req, res, next) => controller.getMetadata(req, res).catch(next));
  return router;
}
