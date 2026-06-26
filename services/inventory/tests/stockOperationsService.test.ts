import { describe, expect, it, vi } from "vitest";
import type { Cache, Idempotency, Logger } from "@atlas/shared";
import { StockOperationsService, lowStockCacheKey } from "../src/domain/stockOperationsService.js";
import type { StockOperationsRepository } from "../src/repositories/stockOperationsRepository.js";

const memoryCache = (): Cache => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async <T>(key: string) => (store.has(key) ? (store.get(key) as T) : null)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    del: vi.fn(async (...keys: string[]) => {
      for (const key of keys) {
        store.delete(key);
      }
    }),
    withCache: vi.fn(async <T>(key: string, _ttlSec: number, loader: () => Promise<T>) => {
      if (store.has(key)) {
        return store.get(key) as T;
      }
      const loaded = await loader();
      store.set(key, loaded);
      return loaded;
    }),
    close: vi.fn()
  } as unknown as Cache;
};

const logger = (): Logger =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn()
  }) as unknown as Logger;

describe("StockOperationsService", () => {
  it("replays transfer results by transfer id", async () => {
    const replay = new Map<string, unknown>();
    const idempotency: Idempotency = {
      run: vi.fn(async (key, _ttlSec, fn) => {
        if (replay.has(key)) {
          return { result: replay.get(key), replayed: true };
        }
        const result = await fn();
        replay.set(key, result);
        return { result, replayed: false };
      })
    };
    const repository = {
      transferStock: vi.fn(async (input) => ({
        transferId: input.transferId,
        productId: input.productId,
        qty: input.qty,
        sourceWarehouseId: input.sourceWarehouseId,
        destinationWarehouseId: input.destinationWarehouseId,
        sourceOnHand: 8,
        destinationOnHand: 12,
        movementIds: ["m1", "m2"],
        replayed: false
      })),
      listLowStock: vi.fn(),
      recordCycleCount: vi.fn()
    } as unknown as StockOperationsRepository;
    const service = new StockOperationsService(repository, memoryCache(), logger(), idempotency);
    const input = {
      transferId: "11111111-1111-4111-8111-111111111111",
      sourceWarehouseId: "22222222-2222-4222-8222-222222222222",
      destinationWarehouseId: "33333333-3333-4333-8333-333333333333",
      productId: "44444444-4444-4444-8444-444444444444",
      qty: 3,
      reason: "rebalance"
    };

    const first = await service.transferStock(input);
    const second = await service.transferStock(input);

    expect(repository.transferStock).toHaveBeenCalledTimes(1);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
  });

  it("uses a stable low-stock cache key", () => {
    expect(lowStockCacheKey({ threshold: 5, limit: 25, offset: 0 })).toBe(
      "inventory:low-stock:v1:all:5:25:0"
    );
  });
});
