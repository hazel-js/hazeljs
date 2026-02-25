# @hazeljs/resilience

Fault-tolerance and resilience patterns for HazelJS. Provides circuit breaker, retry, timeout, bulkhead, rate limiter, and metrics collection — all usable via decorators or programmatic API.

[![npm version](https://img.shields.io/npm/v/@hazeljs/resilience.svg)](https://www.npmjs.com/package/@hazeljs/resilience)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/resilience)](https://www.npmjs.com/package/@hazeljs/resilience)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install @hazeljs/resilience
```

## Features

- **Circuit Breaker** — Prevents cascading failures with sliding window metrics, configurable failure predicates, fallback support, and event-driven state transitions
- **Retry** — Configurable retry with exponential/linear/fixed backoff, jitter, and retryable-error predicates
- **Timeout** — Promise-based timeout wrapper with cancellation
- **Bulkhead** — Concurrency limiter with queue support to isolate failures
- **Rate Limiter** — Token bucket and sliding window strategies
- **Metrics** — Tracks success/failure/latency per target, feeds into gateway canary decisions

## Quick Start

### Decorator API

```typescript
import { Injectable } from '@hazeljs/core';
import { WithCircuitBreaker, WithRetry, WithTimeout, WithBulkhead, Fallback } from '@hazeljs/resilience';

@Injectable()
class PaymentService {
  @WithCircuitBreaker({
    failureThreshold: 5,
    slidingWindow: { type: 'count', size: 20 },
    resetTimeout: 30_000,
    fallback: 'processPaymentFallback',
  })
  @WithRetry({ maxAttempts: 3, backoff: 'exponential', baseDelay: 500 })
  @WithTimeout(5000)
  @WithBulkhead({ maxConcurrent: 10, maxQueue: 50 })
  async processPayment(order: Order): Promise<PaymentResult> {
    return await this.paymentGateway.charge(order);
  }

  @Fallback('processPayment')
  async processPaymentFallback(order: Order): Promise<PaymentResult> {
    return { status: 'queued', message: 'Payment will be processed later' };
  }
}
```

### Programmatic API

```typescript
import { CircuitBreaker, RetryPolicy, Timeout, Bulkhead } from '@hazeljs/resilience';

// Circuit Breaker
const breaker = new CircuitBreaker({ failureThreshold: 5 });
const result = await breaker.execute(() => fetch('/api/data'));

breaker.on('stateChange', (from, to) => console.log(`${from} -> ${to}`));
breaker.getMetrics(); // { totalRequests, failureRate, p99Latency, ... }

// Retry
const retry = new RetryPolicy({ maxAttempts: 3, backoff: 'exponential', baseDelay: 1000 });
const data = await retry.execute(() => fetch('/api/unstable'));

// Timeout
const timeout = new Timeout(5000);
const response = await timeout.execute(() => fetch('/api/slow'));

// Bulkhead
const bulkhead = new Bulkhead({ maxConcurrent: 10, maxQueue: 50 });
const result = await bulkhead.execute(() => intensiveOperation());
```

## Circuit Breaker States

```
CLOSED  ──(failures >= threshold)──>  OPEN
  ^                                     |
  |                                     | (reset timeout)
  |                                     v
  └──(successes >= threshold)──  HALF_OPEN
```

## API Reference

See the [full documentation](https://hazeljs.com/docs/packages/resilience) for complete API reference.

## License

MIT
