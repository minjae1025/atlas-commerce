import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "@atlas/shared";
import {
  ledgerReadService,
  type AccountBalance,
  type LedgerReadRepo,
  type PeriodReportRow,
} from "../src/domain/ledgerReadService.js";

describe("ledger read service", () => {
  it("returns account balances from the read repository", async () => {
    const balance: AccountBalance = {
      account: "merchant_receivable",
      currency: "USD",
      balanceCents: 4200,
      entryCount: 2,
    };
    const repo: LedgerReadRepo = {
      balancesByAccount: vi.fn(async () => [balance]),
      periodReport: vi.fn(),
    };
    const service = ledgerReadService(repo);

    await expect(service.getAccountBalance("merchant_receivable", "USD")).resolves.toEqual({
      account: "merchant_receivable",
      balances: [balance],
    });
    expect(repo.balancesByAccount).toHaveBeenCalledWith("merchant_receivable", "USD");
  });

  it("validates period report date order before querying", async () => {
    const repo: LedgerReadRepo = {
      balancesByAccount: vi.fn(),
      periodReport: vi.fn(async () => []),
    };
    const service = ledgerReadService(repo);

    await expect(service.periodReport("2026-06-15", "2026-06-01", "week"))
      .rejects.toBeInstanceOf(ValidationError);
    expect(repo.periodReport).not.toHaveBeenCalled();
  });

  it("wraps period totals with the requested bucket", async () => {
    const row: PeriodReportRow = {
      bucketStart: "2026-06-01",
      account: "merchant_receivable",
      entryType: "charge",
      currency: "USD",
      totalCents: 2400,
      entryCount: 1,
    };
    const repo: LedgerReadRepo = {
      balancesByAccount: vi.fn(),
      periodReport: vi.fn(async () => [row]),
    };
    const service = ledgerReadService(repo);

    await expect(service.periodReport("2026-06-01", "2026-06-30", "month")).resolves.toEqual({
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      bucket: "month",
      totals: [row],
    });
  });
});
