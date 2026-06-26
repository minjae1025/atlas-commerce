import type { Db } from "@atlas/shared";
import type {
  AccountBalance,
  LedgerReadRepo,
  PeriodReportRow,
  ReportBucket,
} from "../domain/ledgerReadService.js";

interface BalanceRow {
  account: string;
  currency: string;
  balance_cents: string;
  entry_count: string;
}

interface PeriodReportDbRow {
  bucket_start: Date | string;
  account: string;
  entry_type: string;
  currency: string;
  total_cents: string;
  entry_count: string;
}

const bucketSql: Record<ReportBucket, string> = {
  day: "day",
  week: "week",
  month: "month",
};

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

function mapBalance(row: BalanceRow): AccountBalance {
  return {
    account: row.account,
    currency: row.currency,
    balanceCents: Number(row.balance_cents),
    entryCount: Number(row.entry_count),
  };
}

function mapPeriodRow(row: PeriodReportDbRow): PeriodReportRow {
  return {
    bucketStart: toIsoDate(row.bucket_start),
    account: row.account,
    entryType: row.entry_type,
    currency: row.currency,
    totalCents: Number(row.total_cents),
    entryCount: Number(row.entry_count),
  };
}

export function ledgerReadRepo(db: Db): LedgerReadRepo {
  return {
    async balancesByAccount(account: string, currency?: string): Promise<AccountBalance[]> {
      const params: unknown[] = [account];
      const currencyClause = currency !== undefined ? `AND currency = $2` : "";
      if (currency !== undefined) params.push(currency);
      const rows = await db.query<BalanceRow>(
        `SELECT account, currency,
                COALESCE(SUM(amount_cents), 0)::text AS balance_cents,
                COUNT(*)::text AS entry_count
           FROM settlement.ledger_entries
          WHERE account = $1 ${currencyClause}
          GROUP BY account, currency
          ORDER BY currency`,
        params,
      );
      return rows.map(mapBalance);
    },

    async periodReport(
      periodStart: string,
      periodEnd: string,
      bucket: ReportBucket,
    ): Promise<PeriodReportRow[]> {
      const unit = bucketSql[bucket];
      const rows = await db.query<PeriodReportDbRow>(
        `SELECT date_trunc('${unit}', created_at)::date AS bucket_start,
                account, entry_type, currency,
                SUM(amount_cents)::text AS total_cents,
                COUNT(*)::text AS entry_count
           FROM settlement.ledger_entries
          WHERE created_at >= $1::date
            AND created_at < $2::date
          GROUP BY bucket_start, account, entry_type, currency
          ORDER BY bucket_start, account, entry_type, currency`,
        [periodStart, periodEnd],
      );
      return rows.map(mapPeriodRow);
    },
  };
}
