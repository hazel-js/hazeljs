import {
  CountBasedSlidingWindow,
  TimeBasedSlidingWindow,
  createSlidingWindow,
} from '../circuit-breaker/sliding-window';

describe('CountBasedSlidingWindow', () => {
  it('should record entries and compute result', () => {
    const window = new CountBasedSlidingWindow(5);
    window.record(true);
    window.record(false);
    window.record(true);

    const result = window.getResult();
    expect(result.totalCalls).toBe(3);
    expect(result.failureCount).toBe(1);
    expect(result.failureRate).toBeCloseTo(33.33, 1);
  });

  it('should evict oldest when exceeding size', () => {
    const window = new CountBasedSlidingWindow(3);
    window.record(true);
    window.record(false);
    window.record(false);
    window.record(true); // evicts first true

    const result = window.getResult();
    expect(result.totalCalls).toBe(3);
    expect(result.failureCount).toBe(2);
  });

  it('should return zeros when empty', () => {
    const window = new CountBasedSlidingWindow(5);
    const result = window.getResult();
    expect(result.totalCalls).toBe(0);
    expect(result.failureCount).toBe(0);
    expect(result.failureRate).toBe(0);
  });

  it('reset should clear entries', () => {
    const window = new CountBasedSlidingWindow(5);
    window.record(true);
    window.record(false);
    window.reset();

    const result = window.getResult();
    expect(result.totalCalls).toBe(0);
    expect(result.failureCount).toBe(0);
  });
});

describe('TimeBasedSlidingWindow', () => {
  it('should record entries and compute result', () => {
    const window = new TimeBasedSlidingWindow(60_000);
    window.record(true);
    window.record(false);
    window.record(true);

    const result = window.getResult();
    expect(result.totalCalls).toBe(3);
    expect(result.failureCount).toBe(1);
    expect(result.failureRate).toBeCloseTo(33.33, 1);
  });

  it('should evict entries outside window', async () => {
    const window = new TimeBasedSlidingWindow(50);
    window.record(true);
    window.record(false);
    await new Promise((r) => setTimeout(r, 60));
    window.record(true);

    const result = window.getResult();
    expect(result.totalCalls).toBe(1);
    expect(result.failureCount).toBe(0);
  });

  it('should return zeros when empty', () => {
    const window = new TimeBasedSlidingWindow(60_000);
    const result = window.getResult();
    expect(result.totalCalls).toBe(0);
    expect(result.failureCount).toBe(0);
    expect(result.failureRate).toBe(0);
  });

  it('reset should clear entries', () => {
    const window = new TimeBasedSlidingWindow(60_000);
    window.record(true);
    window.record(false);
    window.reset();

    const result = window.getResult();
    expect(result.totalCalls).toBe(0);
    expect(result.failureCount).toBe(0);
  });
});

describe('createSlidingWindow', () => {
  it('should create CountBasedSlidingWindow for count type', () => {
    const window = createSlidingWindow('count', 10);
    expect(window).toBeInstanceOf(CountBasedSlidingWindow);
    window.record(true);
    expect(window.getResult().totalCalls).toBe(1);
  });

  it('should create TimeBasedSlidingWindow for time type', () => {
    const window = createSlidingWindow('time', 5000);
    expect(window).toBeInstanceOf(TimeBasedSlidingWindow);
    window.record(true);
    expect(window.getResult().totalCalls).toBe(1);
  });
});
