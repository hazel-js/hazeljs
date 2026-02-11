import { CircuitBreaker } from '../circuit-breaker/circuit-breaker';
import { CircuitBreakerRegistry } from '../circuit-breaker/circuit-breaker-registry';
import { CircuitState, CircuitBreakerError } from '../types';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 5000,
      resetTimeout: 100, // Short for tests
    });
  });

  describe('CLOSED state', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.isClosed()).toBe(true);
    });

    it('should pass through successful calls', async () => {
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should pass through failing calls and count failures', async () => {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow('fail');
      expect(breaker.getFailureCount()).toBe(1);
    });

    it('should transition to OPEN after failure threshold', async () => {
      for (let i = 0; i < 3; i++) {
        await breaker
          .execute(() => Promise.reject(new Error('fail')))
          .catch(() => {});
      }
      expect(breaker.getState()).toBe(CircuitState.OPEN);
      expect(breaker.isOpen()).toBe(true);
    });
  });

  describe('OPEN state', () => {
    beforeEach(async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await breaker
          .execute(() => Promise.reject(new Error('fail')))
          .catch(() => {});
      }
    });

    it('should reject calls immediately when OPEN', async () => {
      await expect(
        breaker.execute(() => Promise.resolve('should not reach'))
      ).rejects.toThrow(CircuitBreakerError);
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));
      // Next call should be allowed (transitions to HALF_OPEN)
      const result = await breaker.execute(() => Promise.resolve('trial'));
      expect(result).toBe('trial');
    });
  });

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      // Trip the breaker, then wait for reset
      for (let i = 0; i < 3; i++) {
        await breaker
          .execute(() => Promise.reject(new Error('fail')))
          .catch(() => {});
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    it('should transition back to CLOSED after success threshold', async () => {
      // successThreshold = 2
      await breaker.execute(() => Promise.resolve('ok'));
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      await breaker.execute(() => Promise.resolve('ok'));
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition back to OPEN on failure in HALF_OPEN', async () => {
      await breaker.execute(() => Promise.resolve('ok')); // first trial success
      await breaker
        .execute(() => Promise.reject(new Error('fail')))
        .catch(() => {}); // failure -> back to OPEN
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('events', () => {
    it('should emit stateChange events', async () => {
      const transitions: Array<[CircuitState, CircuitState]> = [];
      breaker.on('stateChange', (from, to) => transitions.push([from, to]));

      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await breaker
          .execute(() => Promise.reject(new Error('fail')))
          .catch(() => {});
      }

      expect(transitions).toContainEqual([
        CircuitState.CLOSED,
        CircuitState.OPEN,
      ]);
    });

    it('should emit success and failure events', async () => {
      let successCount = 0;
      let failureCount = 0;
      breaker.on('success', () => successCount++);
      breaker.on('failure', () => failureCount++);

      await breaker.execute(() => Promise.resolve('ok'));
      await breaker
        .execute(() => Promise.reject(new Error('fail')))
        .catch(() => {});

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    });
  });

  describe('metrics', () => {
    it('should track metrics', async () => {
      await breaker.execute(() => Promise.resolve('ok'));
      await breaker
        .execute(() => Promise.reject(new Error('fail')))
        .catch(() => {});

      const metrics = breaker.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successCount).toBe(1);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.failureRate).toBe(50);
    });
  });

  describe('reset', () => {
    it('should reset to CLOSED state', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await breaker
          .execute(() => Promise.reject(new Error('fail')))
          .catch(() => {});
      }
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.reset();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  describe('failure predicate', () => {
    it('should ignore errors that do not match the predicate', async () => {
      const selectiveBreaker = new CircuitBreaker({
        failureThreshold: 1,
        failurePredicate: (error) =>
          error instanceof Error && error.message !== 'ignore-me',
      });

      // This error should NOT count as failure
      await selectiveBreaker
        .execute(() => Promise.reject(new Error('ignore-me')))
        .catch(() => {});
      expect(selectiveBreaker.getState()).toBe(CircuitState.CLOSED);

      // This error SHOULD count
      await selectiveBreaker
        .execute(() => Promise.reject(new Error('count-me')))
        .catch(() => {});
      expect(selectiveBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  beforeEach(() => {
    CircuitBreakerRegistry.clear();
  });

  it('should create and cache circuit breakers', () => {
    const b1 = CircuitBreakerRegistry.getOrCreate('test');
    const b2 = CircuitBreakerRegistry.getOrCreate('test');
    expect(b1).toBe(b2);
  });

  it('should return different breakers for different names', () => {
    const b1 = CircuitBreakerRegistry.getOrCreate('a');
    const b2 = CircuitBreakerRegistry.getOrCreate('b');
    expect(b1).not.toBe(b2);
  });

  it('should reset all breakers', async () => {
    const b = CircuitBreakerRegistry.getOrCreate('test', {
      failureThreshold: 1,
      resetTimeout: 100,
    });
    await b.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    expect(b.getState()).toBe(CircuitState.OPEN);

    CircuitBreakerRegistry.resetAll();
    expect(b.getState()).toBe(CircuitState.CLOSED);
  });
});
