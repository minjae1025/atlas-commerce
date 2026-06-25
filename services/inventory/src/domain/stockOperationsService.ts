import { randomUUID } from "node:crypto";
import { AppError, createIdempotency, type Cache, type Idempotency, type Logger } from "@atlas/shared";
import type { StockOperationsRepository } from "../repositories/stockOperationsRepository.js";
import type {
  CycleCountInput,
  CycleCountResult,
  LowStockQuery,
  LowStockResult,
  TransferStockInput,
  TransferStockResult
} from "./stockOperationsTypes.js";

const LOW_STOCK_TTL_SEC = 20;

export class StockOperationsService {
  private readonly idempotency: Idempotency;

  constructor(
    private readonly repository: StockOperationsRepository,
    private readonly cache: Cache,
    private readonly logger: Logger,
    idempotency?: Idempotency
  ) {
    this.idempotency = idempotency ?? createIdempotency(cache);
  }

  async transferStock(input: TransferStockInput): Promise<TransferStockResult> {
    const transferId = input.transferId ?? randomUUID();
    const normalized = { ...input, transferId };

    try {
      const response = await this.idempotency.run(
        `inventory:transfer:${transferId}`,
        86_400,
        async () => {
          if (normalized.sourceWarehouseId === normalized.destinationWarehouseId) {
            throw new AppError("TRANSFER_SAME_WAREHOUSE", 422, "Transfer requires different warehouses", {
              warehouseId: normalized.sourceWarehouseId
            });
          }

          const result = await this.repository.transferStock(normalized, {
            source: randomUUID(),
            destination: randomUUID()
          });
          if (!result) {
            throw new AppError("TRANSFER_STOCK_UNAVAILABLE", 409, "Transfer source stock is unavailable", {
              sourceWarehouseId: normalized.sourceWarehouseId,
              productId: normalized.productId,
              qty: normalized.qty
            });
          }
          await this.cache.del(lowStockCacheKey({ threshold: 10, limit: 100, offset: 0 }));
          return result;
        }
      );
      return { ...response.result, replayed: response.replayed };
    } catch (error) {
      this.logger.warn("stock transfer failed", {
        transferId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async listLowStock(query: LowStockQuery): Promise<LowStockResult> {
    try {
      return this.cache.withCache(lowStockCacheKey(query), LOW_STOCK_TTL_SEC, () =>
        this.repository.listLowStock(query)
      );
    } catch (error) {
      this.logger.warn("low stock lookup failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async recordCycleCount(input: CycleCountInput): Promise<CycleCountResult> {
    const cycleCountId = input.cycleCountId ?? randomUUID();
    const normalized = { ...input, cycleCountId };

    try {
      const response = await this.idempotency.run(
        `inventory:cycle-count:${cycleCountId}`,
        86_400,
        async () => {
          const result = await this.repository.recordCycleCount(normalized, randomUUID());
          if (!result) {
            throw new AppError("CYCLE_COUNT_REJECTED", 409, "Cycle count cannot reduce below reserved stock", {
              warehouseId: normalized.warehouseId,
              productId: normalized.productId
            });
          }
          await this.cache.del(lowStockCacheKey({ threshold: 10, limit: 100, offset: 0 }));
          return result;
        }
      );
      return { ...response.result, replayed: response.replayed };
    } catch (error) {
      this.logger.warn("cycle count failed", {
        cycleCountId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

export function lowStockCacheKey(query: LowStockQuery): string {
  return [
    "inventory:low-stock:v1",
    query.warehouseId ?? "all",
    query.threshold,
    query.limit,
    query.offset
  ].join(":");
}
