/**
 * Sliding Window implementations for Circuit Breaker
 *
 * Count-based: tracks the last N calls
 * Time-based: tracks calls within a rolling time window
 */

interface WindowEntry {
  timestamp: number;
  success: boolean;
}

export interface SlidingWindowResult {
  totalCalls: number;
  failureCount: number;
  failureRate: number;
}

/**
 * Base sliding window interface
 */
export interface SlidingWindow {
  record(success: boolean): void;
  getResult(): SlidingWindowResult;
  reset(): void;
}

/**
 * Count-based sliding window
 * Tracks the last `size` calls regardless of time
 */
export class CountBasedSlidingWindow implements SlidingWindow {
  private entries: boolean[] = [];

  constructor(private readonly size: number) {}

  record(success: boolean): void {
    this.entries.push(success);
    if (this.entries.length > this.size) {
      this.entries.shift();
    }
  }

  getResult(): SlidingWindowResult {
    const total = this.entries.length;
    if (total === 0) {
      return { totalCalls: 0, failureCount: 0, failureRate: 0 };
    }
    const failures = this.entries.filter((s) => !s).length;
    return {
      totalCalls: total,
      failureCount: failures,
      failureRate: (failures / total) * 100,
    };
  }

  reset(): void {
    this.entries = [];
  }
}

/**
 * Time-based sliding window
 * Tracks calls within a rolling time window of `sizeMs` milliseconds
 */
export class TimeBasedSlidingWindow implements SlidingWindow {
  private entries: WindowEntry[] = [];

  constructor(private readonly sizeMs: number) {}

  record(success: boolean): void {
    this.entries.push({ timestamp: Date.now(), success });
    this.evict();
  }

  getResult(): SlidingWindowResult {
    this.evict();
    const total = this.entries.length;
    if (total === 0) {
      return { totalCalls: 0, failureCount: 0, failureRate: 0 };
    }
    const failures = this.entries.filter((e) => !e.success).length;
    return {
      totalCalls: total,
      failureCount: failures,
      failureRate: (failures / total) * 100,
    };
  }

  reset(): void {
    this.entries = [];
  }

  private evict(): void {
    const cutoff = Date.now() - this.sizeMs;
    let i = 0;
    while (i < this.entries.length && this.entries[i].timestamp < cutoff) {
      i++;
    }
    if (i > 0) {
      this.entries = this.entries.slice(i);
    }
  }
}

/**
 * Factory to create the appropriate sliding window
 */
export function createSlidingWindow(type: 'count' | 'time', size: number): SlidingWindow {
  return type === 'count' ? new CountBasedSlidingWindow(size) : new TimeBasedSlidingWindow(size);
}
