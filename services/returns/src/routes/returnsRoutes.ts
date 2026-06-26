import { Router } from "express";
import type { returnsController } from "../controllers/returnsController.js";

export function returnsRoutes(controller: ReturnType<typeof returnsController>): Router {
  const router = Router();
  router.post("/", (req, res, next) => controller.create(req, res).catch(next));
  router.get("/", (req, res, next) => controller.list(req, res).catch(next));
  router.get("/:id", (req, res, next) => controller.get(req, res).catch(next));
  router.post("/:id/approve", (req, res, next) => controller.approve(req, res).catch(next));
  router.post("/:id/reject", (req, res, next) => controller.reject(req, res).catch(next));
  return router;
}
