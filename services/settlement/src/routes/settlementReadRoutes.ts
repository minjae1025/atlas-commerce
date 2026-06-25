import { Router } from "express";
import type { ledgerReadController } from "../controllers/ledgerReadController.js";
import type { settlementReadController } from "../controllers/settlementReadController.js";

export function settlementReadRoutes(
  ledger: ReturnType<typeof ledgerReadController>,
  settlements: ReturnType<typeof settlementReadController>,
): Router {
  const router = Router();
  router.get("/ledger/accounts/:account/balance", (req, res, next) =>
    ledger.accountBalance(req, res).catch(next),
  );
  router.get("/reports/period", (req, res, next) => ledger.periodReport(req, res).catch(next));
  router.get("/settlements/:id/lines", (req, res, next) =>
    settlements.listLines(req, res).catch(next),
  );
  router.get("/settlements/:id/lines/:lineId", (req, res, next) =>
    settlements.getLine(req, res).catch(next),
  );
  return router;
}
