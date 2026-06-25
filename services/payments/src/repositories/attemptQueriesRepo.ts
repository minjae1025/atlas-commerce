import type { Db } from "@atlas/shared";
import type { PaymentAttempt } from "../types.js";
import type { AttemptSummary } from "../domain/paymentReadService.js";
import type { ListResult, Page } from "../domain/pagination.js";

interface AttemptRow {
  id: string;
  intent_id: string;
  attempt_no: number;
  status: "succeeded" | "failed";
  provider_ref: string;
  error_code: string | null;
  created_at: Date;
}

interface AttemptSummaryRow {
  total_attempts: string;
  succeeded_attempts: string;
  failed_attempts: string;
  last_provider_ref: string | null;
  last_attempt_at: Date | null;
}

function mapAttempt(row: AttemptRow): PaymentAttempt {
  return {
    id: row.id,
    intentId: row.intent_id,
    attemptNo: row.attempt_no,
    status: row.status,
    providerRef: row.provider_ref,
    errorCode: row.error_code,
    createdAt: row.created_at.toISOString(),
  };
}

export function attemptQueriesRepo(db: Db) {
  return {
    async listByIntent(intentId: string, page: Page): Promise<ListResult<PaymentAttempt>> {
      const countRows = await db.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
           FROM payments.payment_attempts
          WHERE intent_id = $1`,
        [intentId],
      );
      const rows = await db.query<AttemptRow>(
        `SELECT *
           FROM payments.payment_attempts
          WHERE intent_id = $1
          ORDER BY attempt_no DESC
          LIMIT $2 OFFSET $3`,
        [intentId, page.limit, page.offset],
      );
      return {
        items: rows.map(mapAttempt),
        total: Number(countRows[0]?.total ?? 0),
      };
    },

    async summarizeByIntent(intentId: string): Promise<AttemptSummary> {
      const rows = await db.query<AttemptSummaryRow>(
        `SELECT
           COUNT(*)::text AS total_attempts,
           COUNT(*) FILTER (WHERE status = 'succeeded')::text AS succeeded_attempts,
           COUNT(*) FILTER (WHERE status = 'failed')::text AS failed_attempts,
           (
             SELECT provider_ref
               FROM payments.payment_attempts
              WHERE intent_id = $1
              ORDER BY attempt_no DESC
              LIMIT 1
           ) AS last_provider_ref,
           MAX(created_at) AS last_attempt_at
         FROM payments.payment_attempts
         WHERE intent_id = $1`,
        [intentId],
      );
      const row = rows[0];
      return {
        totalAttempts: Number(row?.total_attempts ?? 0),
        succeededAttempts: Number(row?.succeeded_attempts ?? 0),
        failedAttempts: Number(row?.failed_attempts ?? 0),
        lastProviderRef: row?.last_provider_ref ?? null,
        lastAttemptAt: row?.last_attempt_at ? row.last_attempt_at.toISOString() : null,
      };
    },
  };
}

export type AttemptQueriesRepo = ReturnType<typeof attemptQueriesRepo>;
