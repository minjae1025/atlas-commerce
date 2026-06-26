import { describe, expect, it } from "vitest";
import { calculateBackoffMs, nextAttemptAt } from "../src/domain/backoff.js";

describe("delivery backoff", () => {
  it("uses exponential backoff after each failed send", () => {
    expect(calculateBackoffMs(1)).toBe(30_000);
    expect(calculateBackoffMs(2)).toBe(60_000);
    expect(calculateBackoffMs(3)).toBe(120_000);
  });

  it("caps retry delay", () => {
    expect(calculateBackoffMs(20)).toBe(15 * 60_000);
  });

  it("computes the next retry timestamp from the supplied clock", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");
    expect(nextAttemptAt(now, 2).toISOString()).toBe("2026-06-15T00:01:00.000Z");
  });
});
