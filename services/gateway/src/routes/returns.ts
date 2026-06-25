import { Router } from 'express';
import type { ProxyController } from '../controllers/proxyController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const returnsRouter = (controller: ProxyController): Router => {
  const router = Router();
  const prefix = '/api';

  router.all('*', asyncHandler((req, res) => controller.forward(req, res, 'returns', prefix)));

  return router;
};
