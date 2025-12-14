import { CircuitBreaker, CircuitState } from '../../src/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
  describe('State Transitions', () => {
    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition to OPEN after failure threshold', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });

      const failingFn = async () => {
        throw new Error('Test failure');
      };

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should block requests when OPEN', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });

      try {
        await breaker.execute(async () => {
          throw new Error('Fail');
        });
      } catch (error) {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      await expect(
        breaker.execute(async () => 'success')
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 100,
      });

      try {
        await breaker.execute(async () => {
          throw new Error('Fail');
        });
      } catch (error) {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      jest.advanceTimersByTime(150);

      try {
        await breaker.execute(async () => 'success');
      } catch (error) {
        // May fail if still OPEN
      }

      expect([CircuitState.HALF_OPEN, CircuitState.CLOSED]).toContain(
        breaker.getState()
      );
    });

    it('should transition to CLOSED after success threshold in HALF_OPEN', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 2,
        resetTimeout: 50,
      });

      try {
        await breaker.execute(async () => {
          throw new Error('Fail');
        });
      } catch (error) {
        // Expected
      }

      jest.advanceTimersByTime(100);

      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Metrics', () => {
    it('should track failure count', async () => {
      const breaker = new CircuitBreaker();

      try {
        await breaker.execute(async () => {
          throw new Error('Fail');
        });
      } catch (error) {
        // Expected
      }

      expect(breaker.getFailureCount()).toBe(1);
    });

    it('should reset failure count on success', async () => {
      const breaker = new CircuitBreaker();

      try {
        await breaker.execute(async () => {
          throw new Error('Fail');
        });
      } catch (error) {
        // Expected
      }

      await breaker.execute(async () => 'success');

      expect(breaker.getFailureCount()).toBe(0);
    });

    it('should track success count in HALF_OPEN', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 50,
      });

      try {
        await breaker.execute(async () => {
          throw new Error('Fail');
        });
      } catch (error) {
        // Expected
      }

      jest.advanceTimersByTime(100);

      await breaker.execute(async () => 'success');

      expect(breaker.getSuccessCount()).toBeGreaterThan(0);
    });
  });

  describe('Manual Control', () => {
    it('should allow manual reset', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });

      try {
        await breaker.execute(async () => {
          throw new Error('Fail');
        });
      } catch (error) {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.reset();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getFailureCount()).toBe(0);
    });
  });
});
