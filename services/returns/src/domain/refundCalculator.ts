import type {
  CalculatedReturn,
  CreateReturnInputLine,
  OrderLineSnapshot,
  OrderSnapshot
} from "./models.js";
import { returnsValidationError } from "./errors.js";

const refundableStatuses = new Set(["confirmed", "shipped"]);

export function assertOrderRefundable(order: OrderSnapshot): void {
  if (!refundableStatuses.has(order.status)) {
    throw returnsValidationError("ORDER_NOT_REFUNDABLE", "Order is not refundable", {
      orderId: order.id,
      status: order.status
    });
  }
}

export function calculateRefundLines(
  order: Pick<OrderSnapshot, "id" | "items">,
  requestedLines: CreateReturnInputLine[]
): CalculatedReturn {
  const orderLinesByProduct = new Map<string, OrderLineSnapshot>();
  for (const item of order.items) {
    orderLinesByProduct.set(item.productId, item);
  }

  const seen = new Set<string>();
  const lines = requestedLines.map((line) => {
    if (seen.has(line.productId)) {
      throw returnsValidationError("DUPLICATE_RETURN_LINE", "Return lines must be unique by product", {
        orderId: order.id,
        productId: line.productId
      });
    }
    seen.add(line.productId);

    const orderLine = orderLinesByProduct.get(line.productId);
    if (!orderLine) {
      throw returnsValidationError("RETURN_LINE_NOT_IN_ORDER", "Return line is not part of the order", {
        orderId: order.id,
        productId: line.productId
      });
    }
    if (line.qty > orderLine.qty) {
      throw returnsValidationError("RETURN_QTY_EXCEEDS_ORDERED", "Return quantity exceeds ordered quantity", {
        orderId: order.id,
        productId: line.productId,
        requestedQty: line.qty,
        orderedQty: orderLine.qty
      });
    }

    return {
      productId: line.productId,
      qty: line.qty,
      refundAmountCents: orderLine.unitPriceCents * line.qty
    };
  });

  return {
    lines,
    totalRefundCents: lines.reduce((sum, line) => sum + line.refundAmountCents, 0)
  };
}
