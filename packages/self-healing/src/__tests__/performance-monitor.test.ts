import { PerformanceMonitor } from '../performance/performance-monitor';

describe('PerformanceMonitor', () => {
  it('detects degraded latency', () => {
    const monitor = new PerformanceMonitor({
      warnLatencyMs: 100,
      criticalLatencyMs: 200,
      sampleSize: 5,
    });

    for (let i = 0; i < 5; i++) {
      monitor.record('OrderService.create', 150);
    }

    const report = monitor.report('OrderService.create');

    expect(report.degraded).toBe(true);
    expect(report.critical).toBe(false);
    expect(report.samples).toBe(5);
  });
});
