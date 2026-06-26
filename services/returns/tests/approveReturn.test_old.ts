import { describe, expect, it, vi } from "vitest";
import type { Idempotency } from "@atlas/shared";
import { approveReturnRequest } from "../src/domain/returnService.js";
import type { ReturnRequest } from "../src/domain/models.js";
import type { ReturnServiceDeps } from "../src/domain/returnService.js";

const returnFixture = (overrides: Partial<ReturnRequest> = {}): ReturnRequest => ({
  id: "55555555-5555-4555-8555-555555555555",
  orderId: "11111111-1111-4111-8111-111111111111",
  customerId: "22222222-2222-4222-8222-222222222222",
  status: "requested",
  reason: "damaged packaging",
  decisionReason: null,
  totalRefundCents: 2400,
  currency: "USD",
  inventoryRestoredAt: null,
  ledgerRecordedAt: null,
  createdAt: "2026-06-15T00:00:00.000Z",
  updatedAt: "2026-06-15T00:00:00.000Z",
  lines: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      returnId: "55555555-5555-4555-8555-555555555555",
      productId: "33333333-3333-4333-8333-333333333333",
      qty: 2,
      refundAmountCents: 2400
    }
  ],
  ...overrides
});

const immediateIdempotency = (): Idempotency =>
  ({
    run: vi.fn(async <T>(_key: string, _ttl: number, fn: () => Promise<T>) => ({
      result: await fn(),
      replayed: false
    }))
  }) as unknown as Idempotency;

const makeDeps = (initial = returnFixture()): ReturnServiceDeps => {
  let current = initial;
  return {
    idempotency: immediateIdempotency(),
    orders: {} as never,
    inventory: {
      getStock: vi.fn(async () => ({
        productId: "33333333-3333-4333-8333-333333333333",
        total: { onHand: 10, reserved: 0 },
        byWarehouse: [
          {
            warehouseId: "77777777-7777-4777-8777-777777777777",
            onHand: 10,
            reserved: 0
          }
        ]
      })),
      createAdjustment: vi.fn(async () => undefined),
      checkReady: vi.fn()
    },
    settlement: {
      postLedgerEntry: vi.fn(async () => undefined),
      checkReady: vi.fn()
    },
    returns: {
      create: vi.fn(),
      findById: vi.fn(async () => current),
      findByIdOrThrow: vi.fn(async () => current),
      list: vi.fn(),
      markApproved: vi.fn(async () => {
        current = returnFixture({ status: "approved" });
        return current;
      }),
      markInventoryRestored: vi.fn(async () => {
        current = returnFixture({
          status: "approved",
          inventoryRestoredAt: "2026-06-15T00:00:01.000Z"
        });
        return current;
      }),
      markLedgerRecorded: vi.fn(async () => {
        current = returnFixture({
          status: "approved",
          inventoryRestoredAt: "2026-06-15T00:00:01.000Z",
          ledgerRecordedAt: "2026-06-15T00:00:02.000Z"
        });
        return current;
      }),
      markRefunded: vi.fn(async () => {
        current = returnFixture({
          status: "refunded",
          inventoryRestoredAt: "2026-06-15T00:00:01.000Z",
          ledgerRecordedAt: "2026-06-15T00:00:02.000Z"
        });
        return current;
      }),
      markRejected: vi.fn()
    }
  } as unknown as ReturnServiceDeps;
};

describe("approveReturnRequest", () => {
  it("restores inventory, posts one refund ledger entry, and marks refunded", async () => {
    const deps = makeDeps();

    const result = await approveReturnRequest(
      deps,
      "55555555-5555-4555-8555-555555555555",
      { requestId: "req-1" }
    );

    expect(result.status).toBe("refunded");
    expect(deps.inventory.createAdjustment).toHaveBeenCalledWith(
      {
        warehouseId: "77777777-7777-4777-8777-777777777777",
        productId: "33333333-3333-4333-8333-333333333333",
        delta: 2,
        reason: "return"
      },
      expect.objectContaining({ returnId: "55555555-5555-4555-8555-555555555555" })
    );
    expect(deps.settlement.postLedgerEntry).toHaveBeenCalledWith(
      {
        account: "refunds",
        orderId: "11111111-1111-4111-8111-111111111111",
        amountCents: 2400,
        currency: "USD",
        entryType: "refund",
        externalRef: "55555555-5555-4555-8555-555555555555"
      },
      expect.any(Object)
    );
    expect(deps.returns.markRefunded).toHaveBeenCalledTimes(1);
  });

  it("does not repeat downstream writes for an already refunded return", async () => {
    const deps = makeDeps(
      returnFixture({
        status: "refunded",
        inventoryRestoredAt: "2026-06-15T00:00:01.000Z",
        ledgerRecordedAt: "2026-06-15T00:00:02.000Z"
      })
    );

    const result = await approveReturnRequest(
      deps,
      "55555555-5555-4555-8555-555555555555",
      { requestId: "req-1" }
    );

    expect(result.status).toBe("refunded");
    expect(deps.inventory.createAdjustment).not.toHaveBeenCalled();
    expect(deps.settlement.postLedgerEntry).not.toHaveBeenCalled();
    expect(deps.returns.markRefunded).not.toHaveBeenCalled();
  });
});
