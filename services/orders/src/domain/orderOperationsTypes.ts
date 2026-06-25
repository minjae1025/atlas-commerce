import type { OrderStatus, ShipmentStatus } from "./models.js";

export type OrderNoteVisibility = "internal" | "customer";

export interface AddOrderNoteInput {
  noteId?: string;
  orderId: string;
  author: string;
  body: string;
  visibility: OrderNoteVisibility;
}

export interface OrderNote {
  noteId: string;
  orderId: string;
  author: string;
  body: string;
  visibility: OrderNoteVisibility;
  createdAt: string;
  replayed: boolean;
}

export interface OrderExportQuery {
  customerId?: string;
  status?: OrderStatus;
  placedFrom?: string;
  placedTo?: string;
  format: "json" | "csv";
  limit: number;
  offset: number;
}

export interface OrderExportItem {
  id: string;
  customerId: string;
  status: OrderStatus;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  itemCount: number;
  placedAt: string;
  updatedAt: string;
}

export interface OrderExportResult {
  format: "json" | "csv";
  items: OrderExportItem[];
  total: number;
  content?: string;
}

export interface ShipmentSlaQuery {
  targetMinutes: number;
  limit: number;
  offset: number;
}

export interface ShipmentSlaItem {
  orderId: string;
  orderStatus: OrderStatus;
  shipmentStatus: ShipmentStatus | null;
  placedAt: string;
  lastShipmentAt: string | null;
  targetMinutes: number;
  minutesOpen: number;
  breached: boolean;
}

export interface ShipmentSlaResult {
  items: ShipmentSlaItem[];
  total: number;
}
