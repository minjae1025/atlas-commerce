export function calculateBackoffMs(attemptsAfterFailure: number, baseDelayMs = 30_000, maxDelayMs = 15 * 60_000): number {
  const exponent = Math.max(0, attemptsAfterFailure - 1);
  return Math.min(baseDelayMs * 2 ** exponent, maxDelayMs);
}

export function nextAttemptAt(now: Date, attemptsAfterFailure: number): Date {
  return new Date(now.getTime() + calculateBackoffMs(attemptsAfterFailure));
}
