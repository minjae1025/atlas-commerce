import { withRetry, type Logger, type ServiceClient } from "@atlas/shared";
import type { RequestContext } from "../domain/models.js";
import { returnConflictError } from "../domain/errors.js";
import { isUpstreamError, warnAndRethrow } from "./upstream.js";

export interface StockSnapshot {
  productId: string;
  total: { onHand: number; reserved: number };
  byWarehouse: Array<{ warehouseId: string; onHand: number; reserved: number }>;
}

export interface InventoryAdjustmentInput {
  warehouseId: string;
  productId: string;
  delta: number;
  reason: string;
}

export interface InventoryClient {
  getStock(productId: string, ctx: RequestContext): Promise<StockSnapshot>;
  createAdjustment(input: InventoryAdjustmentInput, ctx: RequestContext): Promise<void>;
  checkReady(ctx: RequestContext): Promise<void>;
}

export function chooseRestockWarehouse(stock: StockSnapshot): string {
  const [warehouse] = [...stock.byWarehouse].sort(
    (left, right) => right.onHand - left.onHand || left.warehouseId.localeCompare(right.warehouseId)
  );
  if (!warehouse) {
    throw returnConflictError("RETURN_STOCK_LOCATION_NOT_FOUND", "No stock location exists for returned product", {
      productId: stock.productId
    });
  }
  return warehouse.warehouseId;
}

export function createInventoryClient(client: ServiceClient, logger: Logger): InventoryClient {
  return {
    async getStock(productId, ctx) {
      try {
        return await withRetry(
          () => client.get<StockSnapshot>(`/stock/${encodeURIComponent(productId)}`),
          { retries: 2, baseDelayMs: 50 }
        );
      } catch (err) {
        if (isUpstreamError(err)) {
          warnAndRethrow(err, logger, "inventory", "stock lookup", { ...ctx, productId });
        }
        throw err;
      }
    },

    async createAdjustment(input, ctx) {
      try {
        await withRetry(() => client.post("/adjustments", input), {
          retries: 2,
          baseDelayMs: 50
        });
      } catch (err) {
        if (isUpstreamError(err)) {
          warnAndRethrow(err, logger, "inventory", "return adjustment", {
            ...ctx,
            productId: input.productId
          });
        }
        throw err;
      }
    },

    async checkReady(ctx) {
      try {
        await withRetry(() => client.get("/ready"), { retries: 2, baseDelayMs: 25 });
      } catch (err) {
        if (isUpstreamError(err)) {
          warnAndRethrow(err, logger, "inventory", "ready check", ctx);
        }
        throw err;
      }
    }
  };
}
