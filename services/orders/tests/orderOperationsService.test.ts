import { describe, expect, it, vi } from "vitest";
import type { Cache, Idempotency, Logger } from "@atlas/shared";
import {
  OrderOperationsService,
  orderExportCacheKey,
  shipmentSlaCacheKey
} from "../src/domain/orderOperationsService.js";
import type { OrderOperationsRepository } from "../src/repositories/orderOperationsRepository.js";

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

const replayingIdempotency = (): Idempotency => {
  const store = new Map<string, unknown>();
  return {
    run: vi.fn(async (key, _ttlSec, fn) => {
      if (store.has(key)) {
        return { result: store.get(key), replayed: true };
      }
      const result = await fn();
      store.set(key, result);
      return { result, replayed: false };
    })
  };
};

describe("OrderOperationsService", () => {
  it("stores order notes idempotently", async () => {
    const repository = {
      orderExists: vi.fn(async () => true),
      saveNote: vi.fn(async (note) => note),
      exportOrders: vi.fn(),
      listShipmentSla: vi.fn()
    } as unknown as OrderOperationsRepository;
    const service = new OrderOperationsService(
      repository,
      memoryCache(),
      logger(),
      replayingIdempotency()
    );
    const input = {
      noteId: "11111111-1111-4111-8111-111111111111",
      orderId: "22222222-2222-4222-8222-222222222222",
      author: "ops",
      body: "Customer requested dock delivery",
      visibility: "internal" as const
    };

    const first = await service.addNote(input);
    const second = await service.addNote(input);

    expect(repository.saveNote).toHaveBeenCalledTimes(1);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
  });

  it("derives stable cache keys for export and SLA views", () => {
    expect(
      orderExportCacheKey({
        status: "confirmed",
        format: "csv",
        limit: 50,
        offset: 0
      })
    ).toBe("orders:export:v1:all:confirmed:from:to:csv:50:0");
    expect(shipmentSlaCacheKey({ targetMinutes: 240, limit: 25, offset: 10 })).toBe(
      "orders:shipping-sla:v1:240:25:10"
    );
  });
});
