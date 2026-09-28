// Hourly schedule: allow one interval plus a 30-minute grace period.
export function isFreshTimestamp(value: string | null | undefined, now = Date.now(), maxAgeMs = 90 * 60_000): boolean {
  if (!value) return false;
  const age = now - Date.parse(value);
  return Number.isFinite(age) && age >= 0 && age <= maxAgeMs;
}
