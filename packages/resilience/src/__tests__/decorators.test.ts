import 'reflect-metadata';
import { CircuitBreaker, Retry, Timeout, Bulkhead, Fallback, RateLimit } from '../decorators';
import { WithCircuitBreaker, WithRetry, WithTimeout, WithBulkhead, WithRateLimit } from '../index';
import { CircuitBreakerRegistry } from '../circuit-breaker/circuit-breaker-registry';
import { RateLimitError } from '../types';

describe('CircuitBreaker decorator', () => {
  beforeEach(() => {
    CircuitBreakerRegistry.clear();
  });

  it('should wrap method with circuit breaker', async () => {
    class TestService {
      @CircuitBreaker({ failureThreshold: 5, resetTimeout: 100 })
      async success(): Promise<string> {
        return 'ok';
      }
    }
    const svc = new TestService();
    const result = await svc.success();
    expect(result).toBe('ok');
  });

  it('should use fallback when configured and primary fails', async () => {
    class TestService {
      @CircuitBreaker({ failureThreshold: 2, resetTimeout: 100, fallback: 'fallbackMethod' })
      async primary(): Promise<string> {
        throw new Error('primary failed');
      }
      fallbackMethod(): string {
        return 'fallback';
      }
    }
    const svc = new TestService();
    const result = await svc.primary();
    expect(result).toBe('fallback');
  });

  it('should use @Fallback decorator when primary fails', async () => {
    class TestService {
      @CircuitBreaker({ failureThreshold: 2, resetTimeout: 100 })
      async primary(): Promise<string> {
        throw new Error('primary failed');
      }
      @Fallback('primary')
      async primaryFallback(): Promise<string> {
        return 'fallback';
      }
    }
    const svc = new TestService();
    const result = await svc.primary();
    expect(result).toBe('fallback');
  });

  it('should throw when no fallback and primary fails', async () => {
    class TestService {
      @CircuitBreaker({ failureThreshold: 2, resetTimeout: 100 })
      async primary(): Promise<string> {
        throw new Error('primary failed');
      }
    }
    const svc = new TestService();
    await expect(svc.primary()).rejects.toThrow('primary failed');
  });
});

describe('Retry decorator', () => {
  it('should retry on failure and eventually succeed', async () => {
    let attempts = 0;
    class TestService {
      @Retry({ maxAttempts: 5, backoff: 'fixed', baseDelay: 10 })
      async flaky(): Promise<string> {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'ok';
      }
    }
    const svc = new TestService();
    const result = await svc.flaky();
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('should throw after max attempts exhausted', async () => {
    class TestService {
      @Retry({ maxAttempts: 2, backoff: 'fixed', baseDelay: 10 })
      async alwaysFail(): Promise<string> {
        throw new Error('always fail');
      }
    }
    const svc = new TestService();
    await expect(svc.alwaysFail()).rejects.toThrow('Retry exhausted');
  });
});

describe('Timeout decorator', () => {
  it('should resolve when within timeout', async () => {
    class TestService {
      @Timeout(500)
      async fast(): Promise<string> {
        return 'ok';
      }
    }
    const svc = new TestService();
    const result = await svc.fast();
    expect(result).toBe('ok');
  });

  it('should reject when exceeding timeout', async () => {
    class TestService {
      @Timeout(50)
      async slow(): Promise<string> {
        await new Promise((r) => setTimeout(r, 200));
        return 'slow';
      }
    }
    const svc = new TestService();
    await expect(svc.slow()).rejects.toThrow();
  });

  it('should accept config object', async () => {
    class TestService {
      @Timeout({ duration: 500 })
      async fast(): Promise<string> {
        return 'ok';
      }
    }
    const svc = new TestService();
    const result = await svc.fast();
    expect(result).toBe('ok');
  });
});

describe('Bulkhead decorator', () => {
  it('should limit concurrent executions', async () => {
    class TestService {
      @Bulkhead({ maxConcurrent: 1, maxQueue: 0 })
      async limited(): Promise<string> {
        await new Promise((r) => setTimeout(r, 50));
        return 'done';
      }
    }
    const svc = new TestService();
    const [a, b] = await Promise.all([svc.limited(), svc.limited().catch((e) => e.message)]);
    expect(a).toBe('done');
    expect(b).toContain('Bulkhead');
  });
});

describe('RateLimit decorator', () => {
  it('should allow requests within limit', async () => {
    class TestService {
      @RateLimit({ strategy: 'sliding-window', max: 5, window: 60_000 })
      async limited(): Promise<string> {
        return 'ok';
      }
    }
    const svc = new TestService();
    const result = await svc.limited();
    expect(result).toBe('ok');
  });

  it('should throw RateLimitError when limit exceeded', async () => {
    class TestService {
      @RateLimit({ strategy: 'sliding-window', max: 1, window: 60_000 })
      async limited(): Promise<string> {
        return 'ok';
      }
    }
    const svc = new TestService();
    await svc.limited();
    await expect(svc.limited()).rejects.toThrow(RateLimitError);
  });
});

describe('Fallback decorator', () => {
  beforeEach(() => {
    CircuitBreakerRegistry.clear();
  });

  it('should store fallback metadata', async () => {
    class TestService {
      @CircuitBreaker()
      async primary(): Promise<string> {
        return 'ok';
      }
      @Fallback('primary')
      async primaryFallback(): Promise<string> {
        return 'fallback';
      }
    }
    const svc = new TestService();
    const result = await svc.primary();
    expect(result).toBe('ok');
  });
});

describe('Re-exported decorators', () => {
  it('WithCircuitBreaker should equal CircuitBreaker', () => {
    expect(WithCircuitBreaker).toBe(CircuitBreaker);
  });
  it('WithRetry should equal Retry', () => {
    expect(WithRetry).toBe(Retry);
  });
  it('WithTimeout should equal Timeout', () => {
    expect(WithTimeout).toBe(Timeout);
  });
  it('WithBulkhead should equal Bulkhead', () => {
    expect(WithBulkhead).toBe(Bulkhead);
  });
  it('WithRateLimit should equal RateLimit', () => {
    expect(WithRateLimit).toBe(RateLimit);
  });
});
