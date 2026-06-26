import { Router } from 'express';
import type { ProxyController } from '../controllers/proxyController.js';
import { asyncHandler } from '@atlas/shared';

export const inventoryRouter = (controller: ProxyController): Router => {
  const router = Router();
  const prefix = '/api/inventory';

  router.all('*', asyncHandler((req, res) => controller.forward(req, res, 'inventory', prefix)));

  return router;
};
