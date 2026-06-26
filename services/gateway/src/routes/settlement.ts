import { Router } from 'express';
import type { ProxyController } from '../controllers/proxyController.js';
import { asyncHandler } from '@atlas/shared';

export const settlementRouter = (controller: ProxyController): Router => {
  const router = Router();
  const prefix = '/api/settlement';

  router.all('*', asyncHandler((req, res) => controller.forward(req, res, 'settlement', prefix)));

  return router;
};
