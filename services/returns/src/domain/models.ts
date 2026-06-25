export const returnStatuses = ["requested", "approved", "rejected", "refunded"] as const;

export type ReturnStatus = (typeof returnStatuses)[number];

export interface ReturnLine {
  id: string;
  returnId: string;
  productId: string;
  qty: number;
  refundAmountCents: number;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  customerId: string;
  status: ReturnStatus;
  reason: string;
  decisionReason: string | null;
  totalRefundCents: number;
  currency: string;
  inventoryRestoredAt: string | null;
  ledgerRecordedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ReturnLine[];
}

export interface ReturnResponse {
  id: string;
  orderId: string;
  customerId: string;
  status: ReturnStatus;
  reason: string;
  totalRefundCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  lines: ReturnLine[];
}

export interface Page {
  limit: number;
  offset: number;
}

export interface ListResult<T> {
  items: T[];
  total: number;
}

export interface RequestContext {
  requestId?: string;
  returnId?: string;
  orderId?: string;
  customerId?: string;
  productId?: string;
}

export interface OrderLineSnapshot {
  productId: string;
  qty: number;
  unitPriceCents: number;
}

export interface OrderSnapshot {
  id: string;
  customerId: string;
  status: string;
  currency: string;
  items: OrderLineSnapshot[];
}

export interface CreateReturnInputLine {
  productId: string;
  qty: number;
}

export interface CreateReturnInput {
  orderId: string;
  lines: CreateReturnInputLine[];
  reason: string;
}

export interface CalculatedReturnLine extends CreateReturnInputLine {
  refundAmountCents: number;
}

export interface CalculatedReturn {
  lines: CalculatedReturnLine[];
  totalRefundCents: number;
}

export const presentReturn = (request: ReturnRequest): ReturnResponse => ({
  id: request.id,
  orderId: request.orderId,
  customerId: request.customerId,
  status: request.status,
  reason: request.reason,
  totalRefundCents: request.totalRefundCents,
  currency: request.currency,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
  lines: request.lines
});
