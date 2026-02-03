# Production Features Examples

This directory contains examples demonstrating the production-ready features of `@hazeljs/agent`.

## Overview

The `@hazeljs/agent` package now includes comprehensive production features:

- ✅ **Rate Limiting** - Token bucket algorithm to control request rates
- ✅ **Structured Logging** - Multi-level logging with context
- ✅ **Metrics Collection** - Performance and usage tracking
- ✅ **Retry Logic** - Exponential backoff with jitter
- ✅ **Circuit Breaker** - Failure protection and recovery
- ✅ **Health Checks** - Component monitoring and status

## Examples

### 1. Production-Ready Agent (`production-ready.example.ts`)

Basic example showing how to initialize an agent runtime with production features.

```bash
npm run example:production
```

**Features demonstrated:**
- Agent initialization with production config
- Event monitoring
- Basic operations with observability

### 2. Production Features Demo (`production-features.example.ts`)

Comprehensive demonstration of all production features (requires building the package first).

```bash
cd packages/agent
npm run build
cd ../../example
npm run example:production-features
```

**Features demonstrated:**
- Rate limiting with token bucket
- Metrics collection and reporting
- Health check monitoring
- Retry logic with unreliable operations
- Circuit breaker state management
- Event-driven monitoring
- Production dashboard

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/muhammadarslan/repos/hazeljs.com/hazeljs/packages/agent
npm install
```

### 2. Build the Package

```bash
npm run build
```

### 3. Run Examples

```bash
cd ../../example
npm run example:production
```

## Configuration

### Basic Production Setup

```typescript
import { AgentRuntime, LogLevel } from '@hazeljs/agent';

const runtime = new AgentRuntime({
  // Rate limiting
  rateLimitPerMinute: 60,
  
  // Metrics
  enableMetrics: true,
  
  // Resilience
  enableRetry: true,
  enableCircuitBreaker: true,
  
  // Logging
  logLevel: LogLevel.INFO,
  
  // Observability
  enableObservability: true,
});
```

## Feature Details

### Rate Limiting

Controls the rate of agent executions using a token bucket algorithm.

```typescript
// Configure rate limit
const runtime = new AgentRuntime({
  rateLimitPerMinute: 60, // 60 requests per minute
});

// Check status
const status = runtime.getRateLimiterStatus();
console.log(status.availableTokens);
```

**Configuration:**
- `tokensPerMinute`: Number of tokens per minute
- `burstSize`: Maximum burst capacity (optional)

### Structured Logging

Production-ready logging with multiple levels and structured context.

```typescript
import { LogLevel } from '@hazeljs/agent';

const runtime = new AgentRuntime({
  logLevel: LogLevel.INFO, // DEBUG, INFO, WARN, ERROR, FATAL
});
```

**Features:**
- Colored console output for development
- JSON output option for production
- Contextual metadata (agentId, executionId, etc.)
- Custom log handlers

### Metrics Collection

Comprehensive performance and usage metrics.

```typescript
// Get metrics
const metrics = runtime.getMetrics();

console.log(metrics.executions.total);
console.log(metrics.executions.successRate);
console.log(metrics.performance.averageDuration);
console.log(metrics.performance.p95Duration);

// Get formatted summary
console.log(runtime.getMetricsSummary());
```

**Metrics tracked:**
- Execution count and success rate
- Duration statistics (avg, min, max, p50, p95, p99)
- Tool usage by tool name
- LLM call metrics (tokens, errors)
- Memory retrieval metrics

### Retry Logic

Automatic retries with exponential backoff and jitter.

```typescript
const runtime = new AgentRuntime({
  enableRetry: true, // Enabled by default
});
```

**Configuration:**
- `maxRetries`: 3 attempts by default
- `initialDelayMs`: 1000ms initial delay
- `backoffMultiplier`: 2x exponential backoff
- `retryableErrors`: Configurable error types

**Retryable errors:**
- `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`
- `RATE_LIMIT`, `SERVICE_UNAVAILABLE`
- `TIMEOUT`

### Circuit Breaker

Prevents cascading failures by stopping calls to failing services.

```typescript
const runtime = new AgentRuntime({
  enableCircuitBreaker: true, // Enabled by default
});

// Check status
const status = runtime.getCircuitBreakerStatus();
console.log(status.state); // CLOSED, OPEN, HALF_OPEN
console.log(status.failureCount);

// Manual reset
runtime.resetCircuitBreaker();
```

**States:**
- **CLOSED**: Normal operation
- **OPEN**: Service unavailable, requests blocked
- **HALF_OPEN**: Testing if service recovered

**Configuration:**
- `failureThreshold`: 5 failures to open
- `successThreshold`: 2 successes to close
- `resetTimeout`: 30s before retry

### Health Checks

Monitor component health and system status.

```typescript
const health = await runtime.healthCheck();

console.log(health.status); // 'healthy', 'degraded', 'unhealthy'
console.log(health.uptime);
console.log(health.components.llmProvider);
console.log(health.components.ragService);
console.log(health.components.memory);
```

**Health statuses:**
- **HEALTHY**: All components operational
- **DEGRADED**: Some components slow/issues
- **UNHEALTHY**: Critical components down

## Event Monitoring

Subscribe to agent events for real-time monitoring.

```typescript
import { AgentEventType } from '@hazeljs/agent';

runtime.on(AgentEventType.EXECUTION_STARTED, (event) => {
  console.log('Execution started:', event);
});

runtime.on(AgentEventType.EXECUTION_COMPLETED, (event) => {
  console.log('Execution completed:', event);
});

runtime.on(AgentEventType.TOOL_EXECUTION_STARTED, (event) => {
  console.log('Tool started:', event.toolName);
});
```

**Available events:**
- `EXECUTION_STARTED`, `EXECUTION_COMPLETED`, `EXECUTION_FAILED`
- `STEP_STARTED`, `STEP_COMPLETED`, `STEP_FAILED`
- `TOOL_EXECUTION_STARTED`, `TOOL_EXECUTION_COMPLETED`, `TOOL_EXECUTION_FAILED`
- `STATE_CHANGED`, `MEMORY_UPDATED`, `RAG_QUERY_EXECUTED`

## Production Monitoring Dashboard

Example of a comprehensive monitoring dashboard:

```typescript
async function monitoringDashboard(runtime: AgentRuntime) {
  const metrics = runtime.getMetrics();
  const health = await runtime.healthCheck();
  const rateLimiter = runtime.getRateLimiterStatus();
  const circuitBreaker = runtime.getCircuitBreakerStatus();

  console.log('=== Production Dashboard ===');
  console.log(`Health: ${health.status}`);
  console.log(`Uptime: ${health.uptime}s`);
  console.log(`Success Rate: ${metrics.executions.successRate * 100}%`);
  console.log(`Avg Duration: ${metrics.performance.averageDuration}ms`);
  console.log(`Rate Limiter: ${rateLimiter.availableTokens} tokens`);
  console.log(`Circuit Breaker: ${circuitBreaker.state}`);
}
```

## Best Practices

### 1. Always Enable Production Features

```typescript
const runtime = new AgentRuntime({
  rateLimitPerMinute: 60,
  enableMetrics: true,
  enableRetry: true,
  enableCircuitBreaker: true,
  logLevel: LogLevel.INFO,
});
```

### 2. Monitor Health Regularly

```typescript
setInterval(async () => {
  const health = await runtime.healthCheck();
  if (health.status !== 'healthy') {
    console.error('System unhealthy:', health);
    // Alert or take action
  }
}, 30000); // Every 30 seconds
```

### 3. Track Metrics

```typescript
setInterval(() => {
  const metrics = runtime.getMetrics();
  // Send to monitoring service
  sendToDatadog(metrics);
}, 60000); // Every minute
```

### 4. Handle Circuit Breaker Events

```typescript
const runtime = new AgentRuntime({
  enableCircuitBreaker: true,
  // Custom state change handler
});

// Monitor circuit breaker state
setInterval(() => {
  const status = runtime.getCircuitBreakerStatus();
  if (status.state === 'OPEN') {
    console.warn('Circuit breaker OPEN - service degraded');
  }
}, 5000);
```

### 5. Use Structured Logging

```typescript
// Development
const devRuntime = new AgentRuntime({
  logLevel: LogLevel.DEBUG,
});

// Production
const prodRuntime = new AgentRuntime({
  logLevel: LogLevel.INFO,
});
```

## Testing Production Features

### Unit Tests

```bash
cd packages/agent
npm test
```

### Performance Benchmarks

```bash
cd packages/agent
npm run benchmark
```

### Integration Tests

```bash
cd example
npm run example:production
```

## Troubleshooting

### Rate Limit Exceeded

```typescript
const status = runtime.getRateLimiterStatus();
if (!status.availableTokens) {
  console.log('Rate limit exceeded, waiting...');
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

### Circuit Breaker Open

```typescript
const status = runtime.getCircuitBreakerStatus();
if (status.state === 'OPEN') {
  console.log('Circuit breaker open, resetting...');
  runtime.resetCircuitBreaker();
}
```

### High Error Rate

```typescript
const metrics = runtime.getMetrics();
if (metrics.executions.successRate < 0.9) {
  console.error('High error rate detected:', metrics);
  // Investigate and fix
}
```

## Additional Resources

- [PRODUCTION_READINESS.md](../../../packages/agent/PRODUCTION_READINESS.md) - Complete production readiness guide
- [Architecture Documentation](../../../packages/agent/ARCHITECTURE.md) - System architecture
- [API Documentation](../../../packages/agent/README.md) - API reference

## Support

For issues or questions:
- GitHub Issues: https://github.com/hazeljs/hazeljs/issues
- Documentation: https://hazeljs.com/docs
