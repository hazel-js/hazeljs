/**
 * Metrics Collector
 * Tracks success/failure/latency per target. Used internally by circuit breakers
 * and exposed to the gateway for canary deployment decisions.
 */

import { MetricsEntry, MetricsSnapshot } from '../types';

export class MetricsCollector {
  private entries: MetricsEntry[] = [];
  private windowMs: number;

  constructor(windowMs: number = 60_000) {
    this.windowMs = windowMs;
  }

  /**
   * Record a successful call
   */
  recordSuccess(duration: number): void {
    this.entries.push({
      timestamp: Date.now(),
      duration,
      success: true,
    });
    this.evict();
  }

  /**
   * Record a failed call
   */
  recordFailure(duration: number, error?: string): void {
    this.entries.push({
      timestamp: Date.now(),
      duration,
      success: false,
      error,
    });
    this.evict();
  }

  /**
   * Get a snapshot of current metrics within the sliding window
   */
  getSnapshot(): MetricsSnapshot {
    this.evict();
    const entries = this.entries;
    const total = entries.length;

    if (total === 0) {
      return {
        totalCalls: 0,
        successCalls: 0,
        failureCalls: 0,
        failureRate: 0,
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
      };
    }

    const successes = entries.filter((e) => e.success).length;
    const failures = total - successes;
    const durations = entries.map((e) => e.duration).sort((a, b) => a - b);

    return {
      totalCalls: total,
      successCalls: successes,
      failureCalls: failures,
      failureRate: total > 0 ? (failures / total) * 100 : 0,
      averageResponseTime: durations.reduce((a, b) => a + b, 0) / total,
      p50ResponseTime: this.percentile(durations, 50),
      p95ResponseTime: this.percentile(durations, 95),
      p99ResponseTime: this.percentile(durations, 99),
      minResponseTime: durations[0],
      maxResponseTime: durations[durations.length - 1],
      lastCallTime: entries[entries.length - 1]?.timestamp,
    };
  }

  /**
   * Get the current failure rate as a percentage (0-100)
   */
  getFailureRate(): number {
    this.evict();
    if (this.entries.length === 0) return 0;
    const failures = this.entries.filter((e) => !e.success).length;
    return (failures / this.entries.length) * 100;
  }

  /**
   * Get the number of entries in the current window
   */
  getCallCount(): number {
    this.evict();
    return this.entries.length;
  }

  /**
   * Get failure count in the current window
   */
  getFailureCount(): number {
    this.evict();
    return this.entries.filter((e) => !e.success).length;
  }

  /**
   * Get success count in the current window
   */
  getSuccessCount(): number {
    this.evict();
    return this.entries.filter((e) => e.success).length;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.entries = [];
  }

  /**
   * Set the window duration
   */
  setWindow(windowMs: number): void {
    this.windowMs = windowMs;
    this.evict();
  }

  /**
   * Evict entries outside the sliding window
   */
  private evict(): void {
    const cutoff = Date.now() - this.windowMs;
    // Find first entry within window using binary-ish scan
    let i = 0;
    while (i < this.entries.length && this.entries[i].timestamp < cutoff) {
      i++;
    }
    if (i > 0) {
      this.entries = this.entries.slice(i);
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

/**
 * Global registry of metrics collectors, keyed by name
 */
export class MetricsRegistry {
  private static collectors = new Map<string, MetricsCollector>();

  static getOrCreate(name: string, windowMs?: number): MetricsCollector {
    let collector = this.collectors.get(name);
    if (!collector) {
      collector = new MetricsCollector(windowMs);
      this.collectors.set(name, collector);
    }
    return collector;
  }

  static get(name: string): MetricsCollector | undefined {
    return this.collectors.get(name);
  }

  static getAll(): Map<string, MetricsCollector> {
    return new Map(this.collectors);
  }

  static remove(name: string): boolean {
    return this.collectors.delete(name);
  }

  static clear(): void {
    this.collectors.clear();
  }

  static getSnapshot(name: string): MetricsSnapshot | undefined {
    return this.collectors.get(name)?.getSnapshot();
  }

  static getAllSnapshots(): Record<string, MetricsSnapshot> {
    const snapshots: Record<string, MetricsSnapshot> = {};
    for (const [name, collector] of this.collectors) {
      snapshots[name] = collector.getSnapshot();
    }
    return snapshots;
  }
}
