import type { Db } from "@atlas/shared";
import type { IntentStatus, PaymentIntent } from "../types.js";
import type { IntentListFilter } from "../domain/paymentReadService.js";
import type { ListResult, Page } from "../domain/pagination.js";

interface IntentRow {
  id: string;
  order_id: string;
  amount_cents: string;
  currency: string;
  status: IntentStatus;
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
}

function mapIntent(row: IntentRow): PaymentIntent {
  return {
    id: row.id,
    orderId: row.order_id,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function intentQueriesRepo(db: Db) {
  return {
    async findById(id: string): Promise<PaymentIntent | null> {
      const rows = await db.query<IntentRow>(
        `SELECT * FROM payments.payment_intents WHERE id = $1`,
        [id],
      );
      return rows[0] ? mapIntent(rows[0]) : null;
    },

    async list(filter: IntentListFilter, page: Page): Promise<ListResult<PaymentIntent>> {
      const clauses: string[] = [];
      const params: unknown[] = [];

      if (filter.status !== undefined) {
        params.push(filter.status);
        clauses.push(`status = $${params.length}`);
      }
      if (filter.orderId !== undefined) {
        params.push(filter.orderId);
        clauses.push(`order_id = $${params.length}`);
      }
      if (filter.currency !== undefined) {
        params.push(filter.currency);
        clauses.push(`currency = $${params.length}`);
      }

      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

      const countRows = await db.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
           FROM payments.payment_intents
          ${where}`,
        params,
      );

      const limitParam = params.length + 1;
      const offsetParam = params.length + 2;
      const rows = await db.query<IntentRow>(
        `SELECT *
           FROM payments.payment_intents
          ${where}
          ORDER BY created_at DESC, id DESC
          LIMIT $${limitParam} OFFSET $${offsetParam}`,
        [...params, page.limit, page.offset],
      );

      return {
        items: rows.map(mapIntent),
        total: Number(countRows[0]?.total ?? 0),
      };
    },
  };
}

export type IntentQueriesRepo = ReturnType<typeof intentQueriesRepo>;
