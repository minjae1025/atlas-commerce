import { withRetry, type Logger, type ServiceClient } from "@atlas/shared";
import type { RequestContext } from "../domain/models.js";
import { isUpstreamError, warnAndRethrow } from "./upstream.js";

export interface LedgerEntryInput {
  account: string;
  orderId?: string;
  amountCents: number;
  currency: string;
  entryType: "refund";
  externalRef: string;
}

export interface SettlementClient {
  postLedgerEntry(input: LedgerEntryInput, ctx: RequestContext): Promise<void>;
  checkReady(ctx: RequestContext): Promise<void>;
}

export function createSettlementClient(client: ServiceClient, logger: Logger): SettlementClient {
  return {
    async postLedgerEntry(input, ctx) {
      try {
        await withRetry(() => client.post("/ledger/entries", input), {
          retries: 3,
          baseDelayMs: 100
        });
      } catch (err) {
        if (isUpstreamError(err)) {
          const logCtx = input.orderId ? { ...ctx, orderId: input.orderId } : ctx;
          warnAndRethrow(err, logger, "settlement", "refund ledger post", logCtx);
        }
        throw err;
      }
    },

    async checkReady(ctx) {
      try {
        await withRetry(() => client.get("/ready"), { retries: 2, baseDelayMs: 25 });
      } catch (err) {
        if (isUpstreamError(err)) {
          warnAndRethrow(err, logger, "settlement", "ready check", ctx);
        }
        throw err;
      }
    }
  };
}
