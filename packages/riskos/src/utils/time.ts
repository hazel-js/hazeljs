/**
 * Time utilities for timestamps and duration
 */

/** ISO timestamp string */
export function nowISO(): string {
  return new Date().toISOString();
}

/** Unix timestamp in ms */
export function nowMs(): number {
  return Date.now();
}
