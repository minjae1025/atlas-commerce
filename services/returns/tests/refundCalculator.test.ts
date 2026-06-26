import { describe, expect, it } from "vitest";
import {
  assertOrderRefundable,
  calculateRefundLines
} from "../src/domain/refundCalculator.js";
import type { OrderSnapshot } from "../src/domain/models.js";

const order: OrderSnapshot = {
  id: "11111111-1111-4111-8111-111111111111",
  customerId: "22222222-2222-4222-8222-222222222222",
  status: "confirmed",
  currency: "USD",
  items: [
    {
      productId: "33333333-3333-4333-8333-333333333333",
      qty: 3,
      unitPriceCents: 1200
    },
    {
      productId: "44444444-4444-4444-8444-444444444444",
      qty: 1,
      unitPriceCents: 500
    }
  ]
};

describe("refund calculation", () => {
  it("calculates line refunds from order unit prices", () => {
    const calculated = calculateRefundLines(order, [
      { productId: "33333333-3333-4333-8333-333333333333", qty: 2 },
      { productId: "44444444-4444-4444-8444-444444444444", qty: 1 }
    ]);

    expect(calculated).toEqual({
      lines: [
        {
          productId: "33333333-3333-4333-8333-333333333333",
          qty: 2,
          refundAmountCents: 2400
        },
        {
          productId: "44444444-4444-4444-8444-444444444444",
          qty: 1,
          refundAmountCents: 500
        }
      ],
      totalRefundCents: 2900
    });
  });

  it("rejects quantities greater than the purchased line", () => {
    expect(() =>
      calculateRefundLines(order, [
        { productId: "33333333-3333-4333-8333-333333333333", qty: 4 }
      ])
    ).toThrow(expect.objectContaining({ code: "RETURN_QTY_EXCEEDS_ORDERED" }));
  });

  it("rejects non-refundable order states", () => {
    expect(() => assertOrderRefundable({ ...order, status: "cancelled" })).toThrow(
      expect.objectContaining({ code: "ORDER_NOT_REFUNDABLE" })
    );
  });
});
