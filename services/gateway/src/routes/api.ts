import { Router } from 'express';
import type { ProxyController } from '../controllers/proxyController.js';
import { catalogRouter } from './catalog.js';
import { inventoryRouter } from './inventory.js';
import { ordersRouter } from './orders.js';
import { paymentsRouter } from './payments.js';
import { settlementRouter } from './settlement.js';
import { returnsRouter } from './returns.js';
import { notificationsRouter } from './notifications.js';

export const apiRouter = (controller: ProxyController): Router => {
  const router = Router();

  router.use('/catalog', catalogRouter(controller));
  router.use('/inventory', inventoryRouter(controller));
  router.use('/orders', ordersRouter(controller));
  router.use('/payments', paymentsRouter(controller));
  router.use('/settlement', settlementRouter(controller));
  router.use('/returns', returnsRouter(controller));
  router.use('/notifications', notificationsRouter(controller));

  return router;
};
