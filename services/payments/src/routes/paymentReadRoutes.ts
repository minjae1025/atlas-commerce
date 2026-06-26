import { Router } from "express";
import type { paymentReadController } from "../controllers/paymentReadController.js";

export function paymentReadRoutes(controller: ReturnType<typeof paymentReadController>): Router {
  const router = Router();
  router.get("/intents", (req, res, next) => controller.listIntents(req, res).catch(next));
  router.get("/intents/:id/attempts", (req, res, next) => controller.listAttempts(req, res).catch(next));
  router.get("/intents/:id/capture-summary", (req, res, next) =>
    controller.captureSummary(req, res).catch(next),
  );
  return router;
}
