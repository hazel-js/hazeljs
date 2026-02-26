import { MetricsCollector, MetricsRegistry } from '../metrics/metrics-collector';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector(60_000);
  });

  it('should start with empty metrics', () => {
    const snapshot = collector.getSnapshot();
    expect(snapshot.totalCalls).toBe(0);
    expect(snapshot.failureRate).toBe(0);
  });

  it('should record successes', () => {
    collector.recordSuccess(100);
    collector.recordSuccess(200);

    const snapshot = collector.getSnapshot();
    expect(snapshot.totalCalls).toBe(2);
    expect(snapshot.successCalls).toBe(2);
    expect(snapshot.failureCalls).toBe(0);
    expect(snapshot.failureRate).toBe(0);
    expect(snapshot.averageResponseTime).toBe(150);
  });

  it('should record failures', () => {
    collector.recordSuccess(100);
    collector.recordFailure(200, 'error');

    const snapshot = collector.getSnapshot();
    expect(snapshot.totalCalls).toBe(2);
    expect(snapshot.successCalls).toBe(1);
    expect(snapshot.failureCalls).toBe(1);
    expect(snapshot.failureRate).toBe(50);
  });

  it('should calculate percentiles', () => {
    // Record various durations
    for (let i = 1; i <= 100; i++) {
      collector.recordSuccess(i);
    }

    const snapshot = collector.getSnapshot();
    expect(snapshot.p50ResponseTime).toBeGreaterThanOrEqual(49);
    expect(snapshot.p50ResponseTime).toBeLessThanOrEqual(51);
    expect(snapshot.p99ResponseTime).toBeGreaterThanOrEqual(98);
    expect(snapshot.minResponseTime).toBe(1);
    expect(snapshot.maxResponseTime).toBe(100);
  });

  it('should evict entries outside the window', async () => {
    const shortWindow = new MetricsCollector(100); // 100ms window
    shortWindow.recordSuccess(50);

    expect(shortWindow.getCallCount()).toBe(1);

    // Wait for entries to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(shortWindow.getCallCount()).toBe(0);
  });

  it('should reset metrics', () => {
    collector.recordSuccess(100);
    collector.recordFailure(200);
    collector.reset();

    expect(collector.getCallCount()).toBe(0);
    expect(collector.getFailureRate()).toBe(0);
  });
});

describe('MetricsRegistry', () => {
  beforeEach(() => {
    MetricsRegistry.clear();
  });

  it('should create and cache collectors', () => {
    const c1 = MetricsRegistry.getOrCreate('test');
    const c2 = MetricsRegistry.getOrCreate('test');
    expect(c1).toBe(c2);
  });

  it('should return different collectors for different names', () => {
    const c1 = MetricsRegistry.getOrCreate('a');
    const c2 = MetricsRegistry.getOrCreate('b');
    expect(c1).not.toBe(c2);
  });

  it('should get all snapshots', () => {
    MetricsRegistry.getOrCreate('a').recordSuccess(100);
    MetricsRegistry.getOrCreate('b').recordFailure(200);

    const snapshots = MetricsRegistry.getAllSnapshots();
    expect(Object.keys(snapshots)).toHaveLength(2);
    expect(snapshots['a'].totalCalls).toBe(1);
    expect(snapshots['b'].totalCalls).toBe(1);
  });
});
