import { describe, expect, it } from "vitest";
import { providerMetadataService } from "../src/domain/providerMetadataService.js";

describe("provider metadata service", () => {
  it("reports deterministic PSP capabilities", () => {
    const service = providerMetadataService({ failRate: 0.125 });

    expect(service.getMetadata()).toEqual({
      name: "atlas-mock-psp",
      mode: "deterministic",
      captureLatencyMs: { min: 30, max: 80 },
      failureMode: "probabilistic",
      failRate: 0.125,
      supportedCurrencies: ["USD", "KRW", "JPY", "EUR"],
    });
  });
});
