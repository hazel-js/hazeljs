/**
 * Parse memory threshold strings like "500MB", "1GB", or raw bytes.
 */
export function parseMemoryThreshold(threshold: number | string): number {
  if (typeof threshold === 'number') {
    return threshold;
  }

  const normalized = threshold.trim().toUpperCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/);

  if (!match) {
    throw new Error(`Invalid memory threshold: ${threshold}`);
  }

  const value = Number(match[1]);
  const unit = match[2] ?? 'B';

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
  };

  return Math.floor(value * multipliers[unit]);
}

export function getMemoryUsage(): import('../types').MemoryUsageSnapshot {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    rss: usage.rss,
    external: usage.external,
    timestamp: Date.now(),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
  }
  return `${(bytes / 1024 ** 3).toFixed(2)}GB`;
}
