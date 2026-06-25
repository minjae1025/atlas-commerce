import express from "express";
import {
  accessLog,
  errorHandler,
  healthRouter,
  requestId,
  type Cache,
  type Db,
  type Idempotency,
  type Logger,
} from "@atlas/shared";
import { intentsRepo } from "./repositories/intentsRepo.js";
import { attemptsRepo } from "./repositories/attemptsRepo.js";
import { fxRepo } from "./repositories/fxRepo.js";
import { intentQueriesRepo } from "./repositories/intentQueriesRepo.js";
import { attemptQueriesRepo } from "./repositories/attemptQueriesRepo.js";
import { fxCatalogRepo } from "./repositories/fxCatalogRepo.js";
import { pspProvider } from "./provider/pspProvider.js";
import { settlementClient } from "./clients/settlementClient.js";
import { intentService } from "./domain/intentService.js";
import { captureIntentUseCase } from "./domain/captureIntent.js";
import { fxService } from "./domain/fxService.js";
import { paymentReadService } from "./domain/paymentReadService.js";
import { fxCatalogService } from "./domain/fxCatalogService.js";
import { providerMetadataService } from "./domain/providerMetadataService.js";
import { intentsController } from "./controllers/intentsController.js";
import { fxController } from "./controllers/fxController.js";
import { paymentReadController } from "./controllers/paymentReadController.js";
import { fxCatalogController } from "./controllers/fxCatalogController.js";
import { providerController } from "./controllers/providerController.js";
import { intentsRoutes } from "./routes/intentsRoutes.js";
import { fxRoutes } from "./routes/fxRoutes.js";
import { paymentReadRoutes } from "./routes/paymentReadRoutes.js";
import { fxCatalogRoutes } from "./routes/fxCatalogRoutes.js";
import { providerRoutes } from "./routes/providerRoutes.js";

export interface AppDeps {
  db: Db;
  cache: Cache;
  idempotency: Idempotency;
  logger: Logger;
  settlementUrl: string;
  pspFailRate: number;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.use(express.json());
  app.use(requestId());
  app.use(accessLog(deps.logger));

  const intents = intentsRepo(deps.db);
  const attempts = attemptsRepo(deps.db);
  const fx = fxRepo(deps.db);
  const intentQueries = intentQueriesRepo(deps.db);
  const attemptQueries = attemptQueriesRepo(deps.db);
  const fxCatalog = fxCatalogRepo(deps.db);
  const provider = pspProvider({ failRate: deps.pspFailRate });
  const settlement = settlementClient(deps.settlementUrl, deps.logger);

  const intentSvc = intentService(intents, deps.idempotency);
  const captureUseCase = captureIntentUseCase({
    intents,
    attempts,
    provider,
    settlement,
    idempotency: deps.idempotency,
    logger: deps.logger,
  });
  const fxSvc = fxService(fx, deps.cache);
  const paymentReads = paymentReadService(intentQueries, attemptQueries);
  const fxCatalogSvc = fxCatalogService(fxCatalog, deps.cache);
  const providerMetadata = providerMetadataService({ failRate: deps.pspFailRate });

  app.use(
    healthRouter([
      { name: "postgres", check: async () => { await deps.db.query("SELECT 1"); } },
      { name: "redis", check: async () => { await deps.cache.set("payments:ready-probe", 1, 5); } },
    ]),
  );
  app.use(providerRoutes(providerController(providerMetadata)));
  app.use(paymentReadRoutes(paymentReadController(paymentReads)));
  app.use(fxCatalogRoutes(fxCatalogController(fxCatalogSvc)));
  app.use(intentsRoutes(intentsController(intentSvc, captureUseCase)));
  app.use(fxRoutes(fxController(fxSvc)));
  app.use(errorHandler(deps.logger));
  return app;
}
