import { withRetry, type Logger, type ServiceClient } from "@atlas/shared";
import type { OrderSnapshot, RequestContext } from "../domain/models.js";
import { isUpstreamError, warnAndRethrow } from "./upstream.js";

export interface OrdersClient {
  getOrder(orderId: string, ctx: RequestContext): Promise<OrderSnapshot>;
  checkReady(ctx: RequestContext): Promise<void>;
}

export function createOrdersClient(client: ServiceClient, logger: Logger): OrdersClient {
  return {
    async getOrder(orderId, ctx) {
      try {
        return await withRetry(
          () => client.get<OrderSnapshot>(`/orders/${encodeURIComponent(orderId)}`),
          { retries: 2, baseDelayMs: 50 }
        );
      } catch (err) {
        if (isUpstreamError(err)) {
          warnAndRethrow(err, logger, "orders", "lookup", { ...ctx, orderId });
        }
        throw err;
      }
    },

    async checkReady(ctx) {
      try {
        await withRetry(() => client.get("/ready"), { retries: 2, baseDelayMs: 25 });
      } catch (err) {
        if (isUpstreamError(err)) {
          warnAndRethrow(err, logger, "orders", "ready check", ctx);
        }
        throw err;
      }
    }
  };
}
