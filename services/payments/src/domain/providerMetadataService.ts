export interface ProviderMetadata {
  name: "atlas-mock-psp";
  mode: "deterministic";
  captureLatencyMs: {
    min: number;
    max: number;
  };
  failureMode: "disabled" | "probabilistic";
  failRate: number;
  supportedCurrencies: string[];
}

export function providerMetadataService(opts: { failRate: number }) {
  return {
    getMetadata(): ProviderMetadata {
      return {
        name: "atlas-mock-psp",
        mode: "deterministic",
        captureLatencyMs: { min: 30, max: 80 },
        failureMode: opts.failRate > 0 ? "probabilistic" : "disabled",
        failRate: opts.failRate,
        supportedCurrencies: ["USD", "KRW", "JPY", "EUR"],
      };
    },
  };
}

export type ProviderMetadataService = ReturnType<typeof providerMetadataService>;
