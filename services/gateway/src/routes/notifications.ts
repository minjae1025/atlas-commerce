import { Router } from 'express';
import type { ProxyController } from '../controllers/proxyController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const notificationsRouter = (controller: ProxyController): Router => {
  const router = Router();
  const prefix = '/api/notifications';

  router.all('*', asyncHandler((req, res) => controller.forward(req, res, 'notifications', prefix)));

  return router;
};
