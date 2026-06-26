import { randomUUID } from "node:crypto";
import type { Db } from "@atlas/shared";
import type { ClaimedDelivery, DeliveryStatus, ListResult, NotificationDelivery, WebhookEndpoint } from "../domain/types.js";

interface DeliveryRow {
  id: string;
  endpoint_id: string;
  event_type: string;
  payload: unknown;
  status: DeliveryStatus;
  attempts: number;
  last_error: string | null;
  next_attempt_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

type DeliveryListRow = DeliveryRow & { total: string };

interface ClaimedDeliveryRow extends DeliveryRow {
  endpoint_customer_id: string;
  endpoint_url: string;
  endpoint_event_types: string[];
  endpoint_secret: string | null;
  endpoint_active: boolean;
  endpoint_created_at: Date;
}

function mapDelivery(row: DeliveryRow): NotificationDelivery {
  return {
    id: row.id,
    endpointId: row.endpoint_id,
    eventType: row.event_type,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    nextAttemptAt: row.next_attempt_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function mapClaimedDelivery(row: ClaimedDeliveryRow): ClaimedDelivery {
  const endpoint: WebhookEndpoint = {
    id: row.endpoint_id,
    customerId: row.endpoint_customer_id,
    url: row.endpoint_url,
    eventTypes: row.endpoint_event_types,
    secret: row.endpoint_secret,
    active: row.endpoint_active,
    createdAt: row.endpoint_created_at.toISOString()
  };
  return { ...mapDelivery(row), endpoint };
}

export function notificationDeliveryRepository(db: Db) {
  return {
    async enqueue(input: { endpointId: string; eventType: string; payload: unknown }[]): Promise<number> {
      if (input.length === 0) {
        return 0;
      }
      return db.withTx(async (tx) => {
        let created = 0;
        for (const delivery of input) {
          await tx.query(
            `INSERT INTO notifications.notification_deliveries
               (id, endpoint_id, event_type, payload, status, attempts, next_attempt_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4::jsonb, 'pending', 0, now(), now(), now())`,
            [randomUUID(), delivery.endpointId, delivery.eventType, JSON.stringify(delivery.payload)]
          );
          created += 1;
        }
        return created;
      });
    },

    async list(filters: { endpointId?: string; status?: DeliveryStatus }): Promise<ListResult<NotificationDelivery>> {
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (filters.endpointId) {
        params.push(filters.endpointId);
        clauses.push(`endpoint_id = $${params.length}`);
      }
      if (filters.status) {
        params.push(filters.status);
        clauses.push(`status = $${params.length}`);
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = await db.query<DeliveryListRow>(
        `SELECT *, COUNT(*) OVER()::text AS total
           FROM notifications.notification_deliveries
           ${where}
          ORDER BY created_at DESC`,
        params
      );
      return {
        items: rows.map(mapDelivery),
        total: Number(rows[0]?.total ?? 0)
      };
    },

    async findById(id: string): Promise<NotificationDelivery | null> {
      const rows = await db.query<DeliveryRow>(
        `SELECT * FROM notifications.notification_deliveries WHERE id = $1`,
        [id]
      );
      return rows[0] ? mapDelivery(rows[0]) : null;
    },

    async requeueFailed(id: string): Promise<NotificationDelivery | null> {
      const rows = await db.query<DeliveryRow>(
        `UPDATE notifications.notification_deliveries
            SET status = 'pending',
                next_attempt_at = now(),
                updated_at = now()
          WHERE id = $1
            AND status = 'failed'
          RETURNING *`,
        [id]
      );
      return rows[0] ? mapDelivery(rows[0]) : null;
    },

    async claimDueForProcessing(input: {
      limit: number;
      maxAttempts: number;
      leaseUntil: Date;
    }): Promise<ClaimedDelivery[]> {
      const rows = await db.query<ClaimedDeliveryRow>(
        `WITH picked AS (
           SELECT d.id
             FROM notifications.notification_deliveries d
            WHERE d.status IN ('pending', 'failed')
              AND d.attempts < $1
              AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= now())
              AND NOT EXISTS (
                SELECT 1
                  FROM notifications.notification_deliveries older
                 WHERE older.endpoint_id = d.endpoint_id
                   AND older.status IN ('pending', 'failed')
                   AND older.attempts < $1
                   AND (
                     older.created_at < d.created_at
                     OR (older.created_at = d.created_at AND older.id < d.id)
                   )
              )
            ORDER BY d.created_at ASC, d.id ASC
            LIMIT $2
            FOR UPDATE SKIP LOCKED
         )
         UPDATE notifications.notification_deliveries d
            SET next_attempt_at = $3,
                updated_at = now()
           FROM picked,
                notifications.webhook_endpoints e
          WHERE d.id = picked.id
            AND e.id = d.endpoint_id
          RETURNING d.*,
                    e.customer_id AS endpoint_customer_id,
                    e.url AS endpoint_url,
                    e.event_types AS endpoint_event_types,
                    e.secret AS endpoint_secret,
                    e.active AS endpoint_active,
                    e.created_at AS endpoint_created_at`,
        [input.maxAttempts, input.limit, input.leaseUntil]
      );
      return rows.map(mapClaimedDelivery);
    },

    async markDelivered(id: string): Promise<NotificationDelivery | null> {
      const rows = await db.query<DeliveryRow>(
        `UPDATE notifications.notification_deliveries
            SET status = 'delivered',
                last_error = NULL,
                next_attempt_at = NULL,
                updated_at = now()
          WHERE id = $1
          RETURNING *`,
        [id]
      );
      return rows[0] ? mapDelivery(rows[0]) : null;
    },

    async recordFailure(input: {
      id: string;
      error: string;
      maxAttempts: number;
      nextAttemptAt: Date | null;
    }): Promise<NotificationDelivery | null> {
      const rows = await db.query<DeliveryRow>(
        `UPDATE notifications.notification_deliveries
            SET status = 'failed',
                attempts = attempts + 1,
                last_error = $2,
                next_attempt_at = CASE
                  WHEN attempts + 1 >= $3 THEN NULL
                  ELSE $4
                END,
                updated_at = now()
          WHERE id = $1
          RETURNING *`,
        [input.id, input.error.slice(0, 1000), input.maxAttempts, input.nextAttemptAt]
      );
      return rows[0] ? mapDelivery(rows[0]) : null;
    },

    async failPermanently(id: string, error: string): Promise<NotificationDelivery | null> {
      const rows = await db.query<DeliveryRow>(
        `UPDATE notifications.notification_deliveries
            SET status = 'failed',
                attempts = attempts + 1,
                last_error = $2,
                next_attempt_at = NULL,
                updated_at = now()
          WHERE id = $1
          RETURNING *`,
        [id, error.slice(0, 1000)]
      );
      return rows[0] ? mapDelivery(rows[0]) : null;
    }
  };
}

export type NotificationDeliveryRepository = ReturnType<typeof notificationDeliveryRepository>;
