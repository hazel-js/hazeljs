import { PerformanceThresholds } from '../types';

export interface LatencySample {
  durationMs: number;
  timestamp: number;
}

export interface PerformanceReport {
  target: string;
  samples: number;
  averageMs: number;
  p95Ms: number;
  degraded: boolean;
  critical: boolean;
}

/**
 * Tracks method latency and flags performance degradation.
 */
export class PerformanceMonitor {
  private readonly samples = new Map<string, LatencySample[]>();

  constructor(private readonly thresholds: PerformanceThresholds = {}) {}

  record(target: string, durationMs: number): PerformanceReport {
    const sample: LatencySample = { durationMs, timestamp: Date.now() };
    const history = this.samples.get(target) ?? [];
    history.push(sample);

    const sampleSize = this.thresholds.sampleSize ?? 20;
    if (history.length > sampleSize) {
      history.shift();
    }

    this.samples.set(target, history);
    return this.report(target);
  }

  report(target: string): PerformanceReport {
    const history = this.samples.get(target) ?? [];
    const durations = history.map((sample) => sample.durationMs).sort((a, b) => a - b);
    const averageMs =
      durations.length === 0
        ? 0
        : durations.reduce((sum, value) => sum + value, 0) / durations.length;
    const p95Index = Math.max(0, Math.ceil(durations.length * 0.95) - 1);
    const p95Ms = durations[p95Index] ?? 0;

    const warn = this.thresholds.warnLatencyMs ?? 500;
    const critical = this.thresholds.criticalLatencyMs ?? 2000;

    return {
      target,
      samples: durations.length,
      averageMs,
      p95Ms,
      degraded: p95Ms >= warn,
      critical: p95Ms >= critical,
    };
  }

  reset(target?: string): void {
    if (target) {
      this.samples.delete(target);
      return;
    }
    this.samples.clear();
  }
}

export class PerformanceMonitorRegistry {
  private static instance: PerformanceMonitor | null = null;

  static getInstance(thresholds?: PerformanceThresholds): PerformanceMonitor {
    if (!this.instance) {
      this.instance = new PerformanceMonitor(thresholds);
    }
    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
}
