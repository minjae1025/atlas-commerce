import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@atlas/shared";
import {
  paymentReadService,
  type PaymentAttemptQueries,
  type PaymentIntentQueries,
} from "../src/domain/paymentReadService.js";
import type { PaymentAttempt, PaymentIntent } from "../src/types.js";

const intentFixture = (status: PaymentIntent["status"] = "succeeded"): PaymentIntent => ({
  id: "11111111-1111-4111-8111-111111111111",
  orderId: "22222222-2222-4222-8222-222222222222",
  amountCents: 2400,
  currency: "USD",
  status,
  idempotencyKey: "order:22222222-2222-4222-8222-222222222222",
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:01.000Z",
});

const attemptFixture: PaymentAttempt = {
  id: "33333333-3333-4333-8333-333333333333",
  intentId: "11111111-1111-4111-8111-111111111111",
  attemptNo: 1,
  status: "succeeded",
  providerRef: "psp_abc",
  errorCode: null,
  createdAt: "2026-06-12T00:00:02.000Z",
};

describe("payment read service", () => {
  it("passes intent filters and pagination to the query repository", async () => {
    const intent = intentFixture("requires_capture");
    const intents: PaymentIntentQueries = {
      findById: vi.fn(async () => intent),
      list: vi.fn(async () => ({ items: [intent], total: 1 })),
    };
    const attempts: PaymentAttemptQueries = {
      listByIntent: vi.fn(async () => ({ items: [], total: 0 })),
      summarizeByIntent: vi.fn(),
    };
    const service = paymentReadService(intents, attempts);

    const result = await service.listIntents(
      { status: "requires_capture", currency: "USD" },
      { limit: 25, offset: 50 },
    );

    expect(result.total).toBe(1);
    expect(intents.list).toHaveBeenCalledWith(
      { status: "requires_capture", currency: "USD" },
      { limit: 25, offset: 50 },
    );
  });

  it("summarizes captured and remaining cents from intent state", async () => {
    const intents: PaymentIntentQueries = {
      findById: vi.fn(async () => intentFixture("succeeded")),
      list: vi.fn(),
    };
    const attempts: PaymentAttemptQueries = {
      listByIntent: vi.fn(),
      summarizeByIntent: vi.fn(async () => ({
        totalAttempts: 2,
        succeededAttempts: 1,
        failedAttempts: 1,
        lastProviderRef: "psp_latest",
        lastAttemptAt: "2026-06-12T00:00:03.000Z",
      })),
    };
    const service = paymentReadService(intents, attempts);

    await expect(service.getCaptureSummary(intentFixture().id)).resolves.toEqual({
      intentId: intentFixture().id,
      status: "succeeded",
      amountCents: 2400,
      capturedCents: 2400,
      remainingCents: 0,
      attempts: {
        totalAttempts: 2,
        succeededAttempts: 1,
        failedAttempts: 1,
        lastProviderRef: "psp_latest",
        lastAttemptAt: "2026-06-12T00:00:03.000Z",
      },
    });
  });

  it("requires an existing intent before listing attempts", async () => {
    const intents: PaymentIntentQueries = {
      findById: vi.fn(async () => null),
      list: vi.fn(),
    };
    const attempts: PaymentAttemptQueries = {
      listByIntent: vi.fn(async () => ({ items: [attemptFixture], total: 1 })),
      summarizeByIntent: vi.fn(),
    };
    const service = paymentReadService(intents, attempts);

    await expect(
      service.listAttempts("11111111-1111-4111-8111-111111111111", { limit: 10, offset: 0 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(attempts.listByIntent).not.toHaveBeenCalled();
  });
});
