/**
 * Parse durations like "30m", "15m", "1h", or raw milliseconds.
 */
export function parseDuration(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }

  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/i);
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 'ms').toLowerCase();

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
  };

  return Math.floor(amount * multipliers[unit]);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
