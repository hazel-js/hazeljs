/**
 * Parse duration strings like "5s", "1m", "10m", "30d" into milliseconds.
 */
export function parseDurationMs(input: string | number | undefined, fallback: number): number {
  if (input == null) return fallback;
  if (typeof input === 'number') return input;
  const m = String(input)
    .trim()
    .match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = (m[2] ?? 'ms').toLowerCase();
  switch (unit) {
    case 'ms':
      return n;
    case 's':
      return n * 1000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    case 'd':
      return n * 86_400_000;
    default:
      return fallback;
  }
}

/**
 * Simulation / test clock. Real mode uses Date; accelerated advances manually.
 */
export class OrganismClock {
  private accelerated = false;
  private current = Date.now();

  useReal(): void {
    this.accelerated = false;
  }

  useAccelerated(start = Date.now()): void {
    this.accelerated = true;
    this.current = start;
  }

  now(): Date {
    return new Date(this.accelerated ? this.current : Date.now());
  }

  advance(ms: number): void {
    if (this.accelerated) {
      this.current += ms;
    }
  }

  get isAccelerated(): boolean {
    return this.accelerated;
  }
}
