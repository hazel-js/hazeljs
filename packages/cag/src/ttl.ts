/**
 * Parse TTL values like "1h", "30m", "6h", or raw seconds.
 */
export function parseTtlSeconds(ttl: number | string | undefined, fallback = 3600): number {
  if (ttl === undefined) return fallback;
  if (typeof ttl === 'number') {
    return ttl > 0 ? ttl : fallback;
  }
  const trimmed = ttl.trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/.exec(trimmed);
  if (!match) {
    const asNum = Number(trimmed);
    return Number.isFinite(asNum) && asNum > 0 ? asNum : fallback;
  }
  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  switch (unit) {
    case 'ms':
      return Math.max(1, Math.ceil(value / 1000));
    case 's':
      return Math.ceil(value);
    case 'm':
      return Math.ceil(value * 60);
    case 'h':
      return Math.ceil(value * 3600);
    case 'd':
      return Math.ceil(value * 86400);
    default:
      return fallback;
  }
}
