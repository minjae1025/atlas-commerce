import { createHash } from "node:crypto";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return Object.fromEntries(entries.map(([key, entryValue]) => [key, normalize(entryValue)]));
  }
  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function eventIdempotencyKey(eventType: string, payload: unknown): string {
  const hash = createHash("sha256").update(stableJson(payload)).digest("hex");
  return `notifications:event:${eventType}:${hash}`;
}
