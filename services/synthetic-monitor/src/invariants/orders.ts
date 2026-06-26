import type { AlertEmitter } from "../alerts.js";
import type { OrderResponse } from "../types.js";

export const assertOrderTotals = (alerts: AlertEmitter, order: OrderResponse) => {
  const total = order.totalCents ?? 0;
  if (total <= 0) {
    alerts.emit("order_amount_anomaly", {
      orderId: order.id,
      currency: order.currency
    });
  }
};
