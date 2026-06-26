import type { AlertEmitter } from "../alerts.js";
import type { PriceQuote } from "../types.js";

export const assertPrice = (
  alerts: AlertEmitter,
  quote: PriceQuote,
  expectedCents: number
) => {
  if (quote.unitPriceCents !== expectedCents) {
    alerts.emit("price_consistency", {
      productId: quote.productId
    });
  }
};
