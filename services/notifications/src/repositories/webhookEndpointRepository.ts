import { randomUUID } from "node:crypto";
import type { Db } from "@atlas/shared";
import type { ListResult, WebhookEndpoint } from "../domain/types.js";

interface EndpointRow {
  id: string;
  customer_id: string;
  url: string;
  event_types: string[];
  secret: string | null;
  active: boolean;
  created_at: Date;
}

type EndpointListRow = EndpointRow & { total: string };

function mapEndpoint(row: EndpointRow): WebhookEndpoint {
  return {
    id: row.id,
    customerId: row.customer_id,
    url: row.url,
    eventTypes: row.event_types,
    secret: row.secret,
    active: row.active,
    createdAt: row.created_at.toISOString()
  };
}

export function webhookEndpointRepository(db: Db) {
  return {
    async create(input: {
      customerId: string;
      url: string;
      eventTypes: string[];
      secret?: string | null;
    }): Promise<WebhookEndpoint> {
      const rows = await db.query<EndpointRow>(
        `INSERT INTO notifications.webhook_endpoints
           (id, customer_id, url, event_types, secret, active, created_at)
         VALUES ($1, $2, $3, $4, $5, true, now())
         RETURNING *`,
        [randomUUID(), input.customerId, input.url, input.eventTypes, input.secret ?? null]
      );
      return mapEndpoint(rows[0]!);
    },

    async list(filters: { customerId?: string; active?: boolean }): Promise<ListResult<WebhookEndpoint>> {
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (filters.customerId) {
        params.push(filters.customerId);
        clauses.push(`customer_id = $${params.length}`);
      }
      if (filters.active !== undefined) {
        params.push(filters.active);
        clauses.push(`active = $${params.length}`);
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = await db.query<EndpointListRow>(
        `SELECT *, COUNT(*) OVER()::text AS total
           FROM notifications.webhook_endpoints
           ${where}
          ORDER BY created_at DESC`,
        params
      );
      return {
        items: rows.map(mapEndpoint),
        total: Number(rows[0]?.total ?? 0)
      };
    },

    async findById(id: string): Promise<WebhookEndpoint | null> {
      const rows = await db.query<EndpointRow>(
        `SELECT * FROM notifications.webhook_endpoints WHERE id = $1`,
        [id]
      );
      return rows[0] ? mapEndpoint(rows[0]) : null;
    },

    async findActiveByEventType(eventType: string): Promise<WebhookEndpoint[]> {
      const rows = await db.query<EndpointRow>(
        `SELECT *
           FROM notifications.webhook_endpoints
          WHERE active = true
            AND $1 = ANY(event_types)
          ORDER BY created_at ASC`,
        [eventType]
      );
      return rows.map(mapEndpoint);
    },

    async deactivate(id: string): Promise<WebhookEndpoint | null> {
      const rows = await db.query<EndpointRow>(
        `UPDATE notifications.webhook_endpoints
            SET active = false
          WHERE id = $1
          RETURNING *`,
        [id]
      );
      return rows[0] ? mapEndpoint(rows[0]) : null;
    }
  };
}

export type WebhookEndpointRepository = ReturnType<typeof webhookEndpointRepository>;
