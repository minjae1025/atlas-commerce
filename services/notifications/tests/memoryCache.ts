import type { Idempotency } from "@atlas/shared";

interface StoredResult<T> {
  result: T;
  expiresAt: number;
}

export function createMemoryIdempotency(): Idempotency {
  const values = new Map<string, StoredResult<unknown>>();
  return {
    async run<T>(key: string, ttlSec: number, fn: () => Promise<T>) {
      const stored = values.get(key) as StoredResult<T> | undefined;
      if (stored && stored.expiresAt > Date.now()) {
        return { result: stored.result, replayed: true };
      }
      const result = await fn();
      values.set(key, { result, expiresAt: Date.now() + ttlSec * 1000 });
      return { result, replayed: false };
    }
  };
}
