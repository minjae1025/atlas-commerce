import { describe, expect, it } from "vitest";
import { endpointMatchesEvent, matchingEndpoints } from "../src/domain/matching.js";

describe("webhook event matching", () => {
  it("matches active endpoints by exact event type", () => {
    expect(
      endpointMatchesEvent(
        {
          active: true,
          eventTypes: ["order.confirmed", "payment.succeeded"]
        },
        "payment.succeeded"
      )
    ).toBe(true);
  });

  it("does not match inactive endpoints", () => {
    expect(
      endpointMatchesEvent(
        {
          active: false,
          eventTypes: ["order.confirmed"]
        },
        "order.confirmed"
      )
    ).toBe(false);
  });

  it("filters a mixed endpoint list without changing order", () => {
    const matched = matchingEndpoints(
      [
        { id: "first", active: true, eventTypes: ["order.confirmed"] },
        { id: "second", active: true, eventTypes: ["payment.succeeded"] },
        { id: "third", active: false, eventTypes: ["payment.succeeded"] }
      ],
      "payment.succeeded"
    );

    expect(matched.map((endpoint) => endpoint.id)).toEqual(["second"]);
  });
});
