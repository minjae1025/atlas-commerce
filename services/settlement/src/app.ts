import express from "express";
import {
  accessLog,
  errorHandler,
  healthRouter,
  requestId,
  type Cache,
  type Db,
  type Logger,
} from "@atlas/shared";
import { ledgerRepo } from "./repositories/ledgerRepo.js";
import { settlementsRepo } from "./repositories/settlementsRepo.js";
import { ledgerReadRepo } from "./repositories/ledgerReadRepo.js";
import { settlementLinesRepo } from "./repositories/settlementLinesRepo.js";
import { ledgerController } from "./controllers/ledgerController.js";
import { settlementsController } from "./controllers/settlementsController.js";
import { ledgerReadController } from "./controllers/ledgerReadController.js";
import { settlementReadController } from "./controllers/settlementReadController.js";
import { ledgerReadService } from "./domain/ledgerReadService.js";
import { settlementReadService } from "./domain/settlementReadService.js";
import { settlementRoutes } from "./routes/settlementRoutes.js";
import { settlementReadRoutes } from "./routes/settlementReadRoutes.js";

export interface AppDeps {
  db: Db;
  cache: Cache;
  logger: Logger;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.use(express.json());
  app.use(requestId());
  app.use(accessLog(deps.logger));

  const ledger = ledgerRepo(deps.db);
  const settlements = settlementsRepo(deps.db);
  const ledgerReads = ledgerReadService(ledgerReadRepo(deps.db));
  const settlementReads = settlementReadService(settlements, settlementLinesRepo(deps.db));

  app.use(
    healthRouter([
      { name: "postgres", check: async () => { await deps.db.query("SELECT 1"); } },
      { name: "redis", check: async () => { await deps.cache.set("settlement:ready-probe", 1, 5); } },
    ]),
  );
  app.use(settlementRoutes(ledgerController(ledger), settlementsController(settlements)));
  app.use(settlementReadRoutes(
    ledgerReadController(ledgerReads),
    settlementReadController(settlementReads),
  ));
  app.use(errorHandler(deps.logger));
  return app;
}
