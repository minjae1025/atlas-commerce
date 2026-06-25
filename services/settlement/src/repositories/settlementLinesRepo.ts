import type { Db } from "@atlas/shared";
import type { LedgerEntry } from "./ledgerRepo.js";
import type { SettlementLineDetail } from "../domain/settlementReadService.js";
import type { ListResult, Page } from "../domain/pagination.js";

interface SettlementLineRow {
  id: string;
  settlement_id: string;
  ledger_entry_id: string;
  account: string;
  order_id: string | null;
  payment_intent_id: string | null;
  amount_cents: string;
  currency: string;
  entry_type: LedgerEntry["entryType"];
  external_ref: string | null;
  created_at: Date;
}

function mapLine(row: SettlementLineRow): SettlementLineDetail {
  return {
    id: row.id,
    settlementId: row.settlement_id,
    ledgerEntry: {
      id: row.ledger_entry_id,
      account: row.account,
      orderId: row.order_id,
      paymentIntentId: row.payment_intent_id,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      entryType: row.entry_type,
      externalRef: row.external_ref,
      createdAt: row.created_at.toISOString(),
    },
  };
}

const lineSelect = `
  SELECT sl.id, sl.settlement_id, le.id AS ledger_entry_id,
         le.account, le.order_id, le.payment_intent_id, le.amount_cents,
         le.currency, le.entry_type, le.external_ref, le.created_at
    FROM settlement.settlement_lines sl
    JOIN settlement.ledger_entries le ON le.id = sl.ledger_entry_id
`;

export function settlementLinesRepo(db: Db) {
  return {
    async listBySettlement(
      settlementId: string,
      page: Page,
    ): Promise<ListResult<SettlementLineDetail>> {
      const rows = await db.query<SettlementLineRow>(
        `${lineSelect}
          WHERE sl.settlement_id = $1
          ORDER BY le.created_at, sl.id
          LIMIT $2 OFFSET $3`,
        [settlementId, page.limit, page.offset],
      );
      const countRows = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM settlement.settlement_lines
          WHERE settlement_id = $1`,
        [settlementId],
      );
      return {
        items: rows.map(mapLine),
        total: Number(countRows[0]?.count ?? 0),
      };
    },

    async findLine(settlementId: string, lineId: string): Promise<SettlementLineDetail | null> {
      const rows = await db.query<SettlementLineRow>(
        `${lineSelect}
          WHERE sl.settlement_id = $1 AND sl.id = $2`,
        [settlementId, lineId],
      );
      return rows[0] ? mapLine(rows[0]) : null;
    },
  };
}

export type SettlementLinesRepoImpl = ReturnType<typeof settlementLinesRepo>;
