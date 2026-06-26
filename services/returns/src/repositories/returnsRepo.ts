import { randomUUID } from "node:crypto";
import type { Db } from "@atlas/shared";
import {
  returnConflictError,
  returnNotFoundError
} from "../domain/errors.js";
import type {
  CalculatedReturnLine,
  ListResult,
  Page,
  ReturnLine,
  ReturnRequest,
  ReturnStatus
} from "../domain/models.js";

interface ReturnRequestRow {
  id: string;
  order_id: string;
  customer_id: string;
  status: ReturnStatus;
  reason: string;
  decision_reason: string | null;
  total_refund_cents: string | number;
  currency: string;
  inventory_restored_at: Date | string | null;
  ledger_recorded_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ReturnLineRow {
  id: string;
  return_id: string;
  product_id: string;
  qty: number;
  refund_amount_cents: string | number;
}

export interface ReturnListFilter {
  orderId?: string;
  customerId?: string;
  status?: ReturnStatus;
}

export interface CreateReturnRecordInput {
  orderId: string;
  customerId: string;
  reason: string;
  totalRefundCents: number;
  currency: string;
  lines: CalculatedReturnLine[];
}

const requestColumns = `
  id, order_id, customer_id, status, reason, decision_reason, total_refund_cents,
  currency, inventory_restored_at, ledger_recorded_at, created_at, updated_at
`;

const toIso = (value: Date | string | null): string | null => {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const toCents = (value: string | number): number =>
  typeof value === "number" ? value : Number.parseInt(value, 10);

const mapLine = (row: ReturnLineRow): ReturnLine => ({
  id: row.id,
  returnId: row.return_id,
  productId: row.product_id,
  qty: row.qty,
  refundAmountCents: toCents(row.refund_amount_cents)
});

const mapRequest = (row: ReturnRequestRow, lines: ReturnLine[]): ReturnRequest => ({
  id: row.id,
  orderId: row.order_id,
  customerId: row.customer_id,
  status: row.status,
  reason: row.reason,
  decisionReason: row.decision_reason,
  totalRefundCents: toCents(row.total_refund_cents),
  currency: row.currency,
  inventoryRestoredAt: toIso(row.inventory_restored_at),
  ledgerRecordedAt: toIso(row.ledger_recorded_at),
  createdAt: toIso(row.created_at)!,
  updatedAt: toIso(row.updated_at)!,
  lines
});

const loadLines = async (db: Db, returnId: string): Promise<ReturnLine[]> => {
  const rows = await db.query<ReturnLineRow>(
    `
      SELECT id, return_id, product_id, qty, refund_amount_cents
      FROM returns.return_lines
      WHERE return_id = $1
      ORDER BY id
    `,
    [returnId]
  );
  return rows.map(mapLine);
};

const loadFromRow = async (db: Db, row: ReturnRequestRow): Promise<ReturnRequest> =>
  mapRequest(row, await loadLines(db, row.id));

const conflict = (returnId: string, status: ReturnStatus): never => {
  throw returnConflictError("RETURN_STATUS_CONFLICT", "Return status transition is not allowed", {
    returnId,
    status
  });
};

export function returnsRepo(db: Db) {
  const findById = async (returnId: string, dbOverride: Db = db): Promise<ReturnRequest | null> => {
    const rows = await dbOverride.query<ReturnRequestRow>(
      `SELECT ${requestColumns} FROM returns.return_requests WHERE id = $1`,
      [returnId]
    );
    return rows[0] ? loadFromRow(dbOverride, rows[0]) : null;
  };

  const findByIdOrThrow = async (
    returnId: string,
    dbOverride: Db = db
  ): Promise<ReturnRequest> => {
    const request = await findById(returnId, dbOverride);
    if (!request) throw returnNotFoundError(returnId);
    return request;
  };

  const updateAndLoad = async (
    returnId: string,
    sql: string,
    params: unknown[]
  ): Promise<ReturnRequest> => {
    const rows = await db.query<ReturnRequestRow>(sql, params);
    if (rows[0]) return loadFromRow(db, rows[0]);

    const current = await findByIdOrThrow(returnId);
    return conflict(returnId, current.status);
  };

  return {
    async create(input: CreateReturnRecordInput): Promise<ReturnRequest> {
      const returnId = randomUUID();
      await db.withTx(async (tx) => {
        await tx.query(
          `
            INSERT INTO returns.return_requests (
              id, order_id, customer_id, status, reason, total_refund_cents,
              currency, created_at, updated_at
            )
            VALUES ($1, $2, $3, 'requested', $4, $5, $6, now(), now())
          `,
          [
            returnId,
            input.orderId,
            input.customerId,
            input.reason,
            input.totalRefundCents,
            input.currency
          ]
        );

        for (const line of input.lines) {
          await tx.query(
            `
              INSERT INTO returns.return_lines (
                id, return_id, product_id, qty, refund_amount_cents
              )
              VALUES ($1, $2, $3, $4, $5)
            `,
            [randomUUID(), returnId, line.productId, line.qty, line.refundAmountCents]
          );
        }
      });

      return findByIdOrThrow(returnId);
    },

    findById,

    findByIdOrThrow,

    async list(filter: ReturnListFilter, page: Page): Promise<ListResult<ReturnRequest>> {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (filter.orderId) {
        params.push(filter.orderId);
        conditions.push(`order_id = $${params.length}`);
      }
      if (filter.customerId) {
        params.push(filter.customerId);
        conditions.push(`customer_id = $${params.length}`);
      }
      if (filter.status) {
        params.push(filter.status);
        conditions.push(`status = $${params.length}`);
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const countRows = await db.query<{ total: string | number }>(
        `SELECT count(*)::int AS total FROM returns.return_requests ${whereSql}`,
        params
      );

      const listParams = [...params, page.limit, page.offset];
      const rows = await db.query<ReturnRequestRow>(
        `
          SELECT ${requestColumns}
          FROM returns.return_requests
          ${whereSql}
          ORDER BY created_at DESC, id DESC
          LIMIT $${params.length + 1}
          OFFSET $${params.length + 2}
        `,
        listParams
      );

      return {
        items: await Promise.all(rows.map((row) => loadFromRow(db, row))),
        total: Number(countRows[0]?.total ?? 0)
      };
    },

    async markApproved(returnId: string): Promise<ReturnRequest> {
      return updateAndLoad(
        returnId,
        `
          UPDATE returns.return_requests
          SET status = 'approved', updated_at = now()
          WHERE id = $1 AND status = 'requested'
          RETURNING ${requestColumns}
        `,
        [returnId]
      );
    },

    async markInventoryRestored(returnId: string): Promise<ReturnRequest> {
      return updateAndLoad(
        returnId,
        `
          UPDATE returns.return_requests
          SET inventory_restored_at = COALESCE(inventory_restored_at, now()),
              updated_at = now()
          WHERE id = $1 AND status = 'approved'
          RETURNING ${requestColumns}
        `,
        [returnId]
      );
    },

    async markLedgerRecorded(returnId: string): Promise<ReturnRequest> {
      return updateAndLoad(
        returnId,
        `
          UPDATE returns.return_requests
          SET ledger_recorded_at = COALESCE(ledger_recorded_at, now()),
              updated_at = now()
          WHERE id = $1 AND status = 'approved'
          RETURNING ${requestColumns}
        `,
        [returnId]
      );
    },

    async markRefunded(returnId: string): Promise<ReturnRequest> {
      return updateAndLoad(
        returnId,
        `
          UPDATE returns.return_requests
          SET status = 'refunded', updated_at = now()
          WHERE id = $1
            AND status = 'approved'
            AND inventory_restored_at IS NOT NULL
            AND ledger_recorded_at IS NOT NULL
          RETURNING ${requestColumns}
        `,
        [returnId]
      );
    },

    async markRejected(returnId: string, reason?: string): Promise<ReturnRequest> {
      return updateAndLoad(
        returnId,
        `
          UPDATE returns.return_requests
          SET status = 'rejected',
              decision_reason = $2,
              updated_at = now()
          WHERE id = $1 AND status = 'requested'
          RETURNING ${requestColumns}
        `,
        [returnId, reason ?? null]
      );
    }
  };
}

export type ReturnsRepo = ReturnType<typeof returnsRepo>;
