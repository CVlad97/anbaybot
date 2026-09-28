// A configured scanner is not evidence of a recent completed scan.
export function isFreshTimestamp(value: string | null | undefined, now = Date.now(), maxAgeMs = 30 * 60_000): boolean {
  if (!value) return false;
  const age = now - Date.parse(value);
  return Number.isFinite(age) && age >= 0 && age <= maxAgeMs;
}
