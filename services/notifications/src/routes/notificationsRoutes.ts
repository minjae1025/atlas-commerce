import { Router } from "express";
import type { notificationsController } from "../controllers/notificationsController.js";

export function notificationsRoutes(controller: ReturnType<typeof notificationsController>): Router {
  const router = Router();
  router.post("/webhooks", (req, res, next) => controller.createWebhook(req, res).catch(next));
  router.get("/webhooks", (req, res, next) => controller.listWebhooks(req, res).catch(next));
  router.get("/webhooks/:id", (req, res, next) => controller.getWebhook(req, res).catch(next));
  router.delete("/webhooks/:id", (req, res, next) => controller.deleteWebhook(req, res).catch(next));
  router.post("/events", (req, res, next) => controller.publishEvent(req, res).catch(next));
  router.get("/deliveries", (req, res, next) => controller.listDeliveries(req, res).catch(next));
  router.post("/deliveries/:id/retry", (req, res, next) => controller.retryDelivery(req, res).catch(next));
  return router;
}
