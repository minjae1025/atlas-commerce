import type { Cache, Db } from "@atlas/shared";
import type {
  OrderExportItem,
  OrderExportQuery,
  OrderExportResult,
  OrderNote,
  ShipmentSlaItem,
  ShipmentSlaQuery,
  ShipmentSlaResult
} from "../domain/orderOperationsTypes.js";

interface ExistsRow {
  exists: boolean;
}

interface CountRow {
  total: string | number;
}

interface OrderExportRow {
  id: string;
  customerId: string;
  status: OrderExportItem["status"];
  currency: string;
  subtotalCents: string | number;
  totalCents: string | number;
  itemCount: string | number;
  placedAt: Date | string;
  updatedAt: Date | string;
}

interface ShipmentSlaRow {
  orderId: string;
  orderStatus: ShipmentSlaItem["orderStatus"];
  shipmentStatus: ShipmentSlaItem["shipmentStatus"];
  placedAt: Date | string;
  lastShipmentAt: Date | string | null;
  minutesOpen: string | number;
}

export class OrderOperationsRepository {
  constructor(
    private readonly db: Db,
    private readonly cache: Cache
  ) {}

  async orderExists(orderId: string): Promise<boolean> {
    const rows = await this.db.query<ExistsRow>(
      "select exists(select 1 from orders where id = $1) as exists",
      [orderId]
    );
    return rows[0]?.exists ?? false;
  }

  async saveNote(note: OrderNote, ttlSec: number): Promise<OrderNote> {
    await this.cache.set(orderNoteKey(note.orderId, note.noteId), note, ttlSec);
    return note;
  }

  async exportOrders(query: OrderExportQuery): Promise<OrderExportResult> {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (query.customerId) {
      params.push(query.customerId);
      conditions.push(`o.customer_id = $${params.length}`);
    }
    if (query.status) {
      params.push(query.status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (query.placedFrom) {
      params.push(query.placedFrom);
      conditions.push(`o.placed_at >= $${params.length}`);
    }
    if (query.placedTo) {
      params.push(query.placedTo);
      conditions.push(`o.placed_at <= $${params.length}`);
    }

    const whereSql = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
    const countRows = await this.db.query<CountRow>(
      `select count(*)::int as total from orders o ${whereSql}`,
      params
    );

    const rows = await this.db.query<OrderExportRow>(
      `
      select
        o.id,
        o.customer_id as "customerId",
        o.status,
        o.currency,
        o.subtotal_cents as "subtotalCents",
        o.total_cents as "totalCents",
        count(oi.id)::int as "itemCount",
        o.placed_at as "placedAt",
        o.updated_at as "updatedAt"
      from orders o
      left join order_items oi on oi.order_id = o.id
      ${whereSql}
      group by o.id
      order by o.placed_at desc, o.id desc
      limit $${params.length + 1}
      offset $${params.length + 2}
      `,
      [...params, query.limit, query.offset]
    );

    const items = rows.map(mapOrderExportRow);
    return {
      format: query.format,
      items,
      total: Number(countRows[0]?.total ?? 0)
    };
  }

  async listShipmentSla(query: ShipmentSlaQuery): Promise<ShipmentSlaResult> {
    const params = [query.targetMinutes, query.limit, query.offset];
    const countRows = await this.db.query<CountRow>(
      `
      select count(*)::int as total
      from orders o
      where o.status in ('confirmed', 'shipped')
      `
    );

    const rows = await this.db.query<ShipmentSlaRow>(
      `
      select
        o.id as "orderId",
        o.status as "orderStatus",
        s.status as "shipmentStatus",
        o.placed_at as "placedAt",
        s.created_at as "lastShipmentAt",
        floor(extract(epoch from (now() - o.placed_at)) / 60)::int as "minutesOpen"
      from orders o
      left join lateral (
        select status, created_at
        from shipments
        where order_id = o.id
        order by created_at desc
        limit 1
      ) s on true
      where o.status in ('confirmed', 'shipped')
      order by (floor(extract(epoch from (now() - o.placed_at)) / 60) > $1) desc,
               o.placed_at asc,
               o.id asc
      limit $2
      offset $3
      `,
      params
    );

    return {
      items: rows.map((row) => mapShipmentSlaRow(row, query.targetMinutes)),
      total: Number(countRows[0]?.total ?? 0)
    };
  }
}

export function orderNoteKey(orderId: string, noteId: string): string {
  return `orders:note:v1:${orderId}:${noteId}`;
}

function mapOrderExportRow(row: OrderExportRow): OrderExportItem {
  return {
    id: row.id,
    customerId: row.customerId,
    status: row.status,
    currency: row.currency,
    subtotalCents: Number(row.subtotalCents),
    totalCents: Number(row.totalCents),
    itemCount: Number(row.itemCount),
    placedAt: toIso(row.placedAt),
    updatedAt: toIso(row.updatedAt)
  };
}

function mapShipmentSlaRow(row: ShipmentSlaRow, targetMinutes: number): ShipmentSlaItem {
  const minutesOpen = Number(row.minutesOpen);
  return {
    orderId: row.orderId,
    orderStatus: row.orderStatus,
    shipmentStatus: row.shipmentStatus,
    placedAt: toIso(row.placedAt),
    lastShipmentAt: row.lastShipmentAt ? toIso(row.lastShipmentAt) : null,
    targetMinutes,
    minutesOpen,
    breached: minutesOpen > targetMinutes
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
