import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@atlas/shared";
import {
  settlementReadService,
  type SettlementLineDetail,
  type SettlementLinesRepo,
} from "../src/domain/settlementReadService.js";
import type { Settlement } from "../src/repositories/settlementsRepo.js";

const settlementFixture: Settlement = {
  id: "11111111-1111-4111-8111-111111111111",
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
  status: "draft",
  totalCents: 2400,
  createdAt: "2026-06-12T00:00:00.000Z",
  lineCount: 1,
};

const lineFixture: SettlementLineDetail = {
  id: "22222222-2222-4222-8222-222222222222",
  settlementId: settlementFixture.id,
  ledgerEntry: {
    id: "33333333-3333-4333-8333-333333333333",
    account: "merchant_receivable",
    orderId: "44444444-4444-4444-8444-444444444444",
    paymentIntentId: "55555555-5555-4555-8555-555555555555",
    amountCents: 2400,
    currency: "USD",
    entryType: "charge",
    externalRef: "psp_abc",
    createdAt: "2026-06-12T00:00:00.000Z",
  },
};

describe("settlement read service", () => {
  it("requires an existing settlement before listing lines", async () => {
    const settlements = { findById: vi.fn(async () => null) };
    const lines: SettlementLinesRepo = {
      listBySettlement: vi.fn(async () => ({ items: [lineFixture], total: 1 })),
      findLine: vi.fn(),
    };
    const service = settlementReadService(settlements, lines);

    await expect(
      service.listLines(settlementFixture.id, { limit: 10, offset: 0 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(lines.listBySettlement).not.toHaveBeenCalled();
  });

  it("returns a settlement line detail when both settlement and line exist", async () => {
    const settlements = { findById: vi.fn(async () => settlementFixture) };
    const lines: SettlementLinesRepo = {
      listBySettlement: vi.fn(),
      findLine: vi.fn(async () => lineFixture),
    };
    const service = settlementReadService(settlements, lines);

    await expect(service.getLine(settlementFixture.id, lineFixture.id)).resolves.toEqual(lineFixture);
    expect(lines.findLine).toHaveBeenCalledWith(settlementFixture.id, lineFixture.id);
  });

  it("returns not found for a missing line in an existing settlement", async () => {
    const settlements = { findById: vi.fn(async () => settlementFixture) };
    const lines: SettlementLinesRepo = {
      listBySettlement: vi.fn(),
      findLine: vi.fn(async () => null),
    };
    const service = settlementReadService(settlements, lines);

    await expect(service.getLine(settlementFixture.id, lineFixture.id))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});
