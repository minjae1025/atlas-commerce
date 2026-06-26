import { randomUUID } from "node:crypto";
import { createIdempotency, type Cache, type Idempotency, type Logger } from "@atlas/shared";
import { orderNotFoundError } from "./errors.js";
import type {
  AddOrderNoteInput,
  OrderExportQuery,
  OrderExportResult,
  OrderNote,
  ShipmentSlaQuery,
  ShipmentSlaResult
} from "./orderOperationsTypes.js";
import type { OrderOperationsRepository } from "../repositories/orderOperationsRepository.js";

const ORDER_NOTE_TTL_SEC = 2_592_000;
const ORDER_EXPORT_TTL_SEC = 30;
const SHIPMENT_SLA_TTL_SEC = 20;

export class OrderOperationsService {
  private readonly idempotency: Idempotency;

  constructor(
    private readonly repository: OrderOperationsRepository,
    private readonly cache: Cache,
    private readonly logger: Logger,
    idempotency?: Idempotency
  ) {
    this.idempotency = idempotency ?? createIdempotency(cache);
  }

  async addNote(input: AddOrderNoteInput): Promise<OrderNote> {
    const noteId = input.noteId ?? randomUUID();
    try {
      const response = await this.idempotency.run(
        `orders:note:${input.orderId}:${noteId}`,
        ORDER_NOTE_TTL_SEC,
        async () => {
          const exists = await this.repository.orderExists(input.orderId);
          if (!exists) {
            throw orderNotFoundError(input.orderId);
          }
          return this.repository.saveNote(
            {
              noteId,
              orderId: input.orderId,
              author: input.author,
              body: input.body,
              visibility: input.visibility,
              createdAt: new Date().toISOString(),
              replayed: false
            },
            ORDER_NOTE_TTL_SEC
          );
        }
      );
      return { ...response.result, replayed: response.replayed };
    } catch (error) {
      this.logger.warn("order note write failed", {
        orderId: input.orderId,
        noteId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async exportOrders(query: OrderExportQuery): Promise<OrderExportResult> {
    try {
      const result = await this.cache.withCache(orderExportCacheKey(query), ORDER_EXPORT_TTL_SEC, () =>
        this.repository.exportOrders(query)
      );
      if (query.format === "csv") {
        return { ...result, content: toCsv(result.items) };
      }
      return result;
    } catch (error) {
      this.logger.warn("order export failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async shipmentSla(query: ShipmentSlaQuery): Promise<ShipmentSlaResult> {
    try {
      return this.cache.withCache(shipmentSlaCacheKey(query), SHIPMENT_SLA_TTL_SEC, () =>
        this.repository.listShipmentSla(query)
      );
    } catch (error) {
      this.logger.warn("shipment sla lookup failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

export function orderExportCacheKey(query: OrderExportQuery): string {
  return [
    "orders:export:v1",
    query.customerId ?? "all",
    query.status ?? "all",
    query.placedFrom ?? "from",
    query.placedTo ?? "to",
    query.format,
    query.limit,
    query.offset
  ].join(":");
}

export function shipmentSlaCacheKey(query: ShipmentSlaQuery): string {
  return ["orders:shipping-sla:v1", query.targetMinutes, query.limit, query.offset].join(":");
}

function toCsv(items: OrderExportResult["items"]): string {
  const header = [
    "id",
    "customerId",
    "status",
    "currency",
    "subtotalCents",
    "totalCents",
    "itemCount",
    "placedAt",
    "updatedAt"
  ];
  const rows = items.map((item) =>
    [
      item.id,
      item.customerId,
      item.status,
      item.currency,
      item.subtotalCents,
      item.totalCents,
      item.itemCount,
      item.placedAt,
      item.updatedAt
    ].map(csvCell).join(",")
  );
  return [header.join(","), ...rows].join("\n");
}

function csvCell(value: string | number): string {
  const raw = String(value);
  return /[",\n]/.test(raw) ? `"${raw.replaceAll("\"", "\"\"")}"` : raw;
}
