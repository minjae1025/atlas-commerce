import { ValidationError } from "@atlas/shared";

export type ReportBucket = "day" | "week" | "month";

export interface AccountBalance {
  account: string;
  currency: string;
  balanceCents: number;
  entryCount: number;
}

export interface AccountBalanceResult {
  account: string;
  balances: AccountBalance[];
}

export interface PeriodReportRow {
  bucketStart: string;
  account: string;
  entryType: string;
  currency: string;
  totalCents: number;
  entryCount: number;
}

export interface PeriodReport {
  periodStart: string;
  periodEnd: string;
  bucket: ReportBucket;
  totals: PeriodReportRow[];
}

export interface LedgerReadRepo {
  balancesByAccount(account: string, currency?: string): Promise<AccountBalance[]>;
  periodReport(periodStart: string, periodEnd: string, bucket: ReportBucket): Promise<PeriodReportRow[]>;
}

export function ledgerReadService(ledger: LedgerReadRepo) {
  return {
    async getAccountBalance(account: string, currency?: string): Promise<AccountBalanceResult> {
      return {
        account,
        balances: await ledger.balancesByAccount(account, currency),
      };
    },

    async periodReport(
      periodStart: string,
      periodEnd: string,
      bucket: ReportBucket,
    ): Promise<PeriodReport> {
      if (periodEnd < periodStart) {
        throw new ValidationError("periodEnd must not precede periodStart");
      }
      return {
        periodStart,
        periodEnd,
        bucket,
        totals: await ledger.periodReport(periodStart, periodEnd, bucket),
      };
    },
  };
}

export type LedgerReadService = ReturnType<typeof ledgerReadService>;
