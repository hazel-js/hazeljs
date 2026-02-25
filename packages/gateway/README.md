# @hazeljs/gateway

Intelligent API Gateway for HazelJS with version-based routing, canary deployments, circuit breaking, traffic management, and automatic rollback.

[![npm version](https://img.shields.io/npm/v/@hazeljs/gateway.svg)](https://www.npmjs.com/package/@hazeljs/gateway)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/gateway)](https://www.npmjs.com/package/@hazeljs/gateway)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install @hazeljs/gateway
```

## Features

- **Config-Driven Routes** — Define routes from env vars / config files via `@hazeljs/config`
- **Declarative Gateway** — Or use decorators for simple setups and prototyping
- **Canary Deployments** — Automatic traffic shifting with error-rate monitoring and rollback
- **Version Routing** — Route by header, URI prefix, query parameter, or weighted random
- **Circuit Breaker** — Per-route circuit breaker protection via `@hazeljs/resilience`
- **Traffic Mirroring** — Shadow traffic to test new versions without affecting users
- **Rate Limiting** — Per-route rate limiting
- **Request Transformation** — Transform requests/responses in flight
- **Metrics** — Real-time per-route and per-version metrics

## Quick Start — Config-Driven (Recommended)

The config-driven approach reads all gateway settings from environment variables, making it easy to change behavior across environments without code changes.

### 1. Create a config loader (`gateway.config.ts`)

```typescript
const gatewayConfig = () => ({
  gateway: {
    discovery: {
      cacheEnabled: process.env.GATEWAY_CACHE_ENABLED !== 'false',
      cacheTTL: parseInt(process.env.GATEWAY_CACHE_TTL || '30000'),
    },
    resilience: {
      defaultCircuitBreaker: {
        failureThreshold: parseInt(process.env.GATEWAY_CB_THRESHOLD || '5'),
        resetTimeout: parseInt(process.env.GATEWAY_CB_RESET_TIMEOUT || '30000'),
      },
      defaultTimeout: parseInt(process.env.GATEWAY_DEFAULT_TIMEOUT || '5000'),
    },
    routes: [
      {
        path: '/api/users/**',
        serviceName: 'user-service',
        serviceConfig: { stripPrefix: '/api/users', addPrefix: '/users' },
        circuitBreaker: {
          failureThreshold: parseInt(process.env.USER_SVC_CB_THRESHOLD || '10'),
        },
        rateLimit: {
          strategy: 'sliding-window',
          max: parseInt(process.env.USER_SVC_RATE_LIMIT_MAX || '100'),
          window: 60000,
        },
      },
      {
        path: '/api/orders/**',
        serviceName: 'order-service',
        canary: {
          stable: { version: process.env.ORDER_STABLE_VERSION || 'v1', weight: 90 },
          canary: { version: process.env.ORDER_CANARY_VERSION || 'v2', weight: 10 },
          promotion: {
            strategy: 'error-rate',
            errorThreshold: parseInt(process.env.ORDER_CANARY_ERROR_THRESHOLD || '5'),
            evaluationWindow: '5m',
            autoPromote: true,
            autoRollback: true,
            steps: [10, 25, 50, 75, 100],
            stepInterval: '10m',
          },
        },
      },
    ],
  },
});

export default gatewayConfig;
```

### 2. Wire it up with `ConfigModule` and `GatewayServer.fromConfig()`

```typescript
import { ConfigModule, ConfigService } from '@hazeljs/config';
import { GatewayServer, GatewayModule } from '@hazeljs/gateway';
import gatewayConfig from './gateway.config';

// Register the config loader
ConfigModule.forRoot({
  envFilePath: ['.env', '.env.local'],
  isGlobal: true,
  load: [gatewayConfig],
});

// Register gateway module
GatewayModule.forRoot({ configKey: 'gateway' });

// Resolve and create
const configService = new ConfigService();
const config = GatewayModule.resolveConfig(configService);
const gateway = GatewayServer.fromConfig(config);

gateway.startCanaries();
```

### 3. Set env vars per environment

```bash
# .env (development)
ORDER_CANARY_VERSION=v2
ORDER_CANARY_ERROR_THRESHOLD=5
USER_SVC_RATE_LIMIT_MAX=100

# .env.production
ORDER_CANARY_VERSION=v3
ORDER_CANARY_ERROR_THRESHOLD=2
USER_SVC_RATE_LIMIT_MAX=500
```

## Declarative API (Decorators)

Decorators remain available for quick prototypes and when you prefer co-located configuration:

```typescript
import { Gateway, Route, ServiceRoute, Canary, GatewayCircuitBreaker, GatewayRateLimit, GatewayServer } from '@hazeljs/gateway';

@Gateway({
  resilience: { defaultCircuitBreaker: { failureThreshold: 5 } },
  metrics: { enabled: true, collectionInterval: '10s' },
})
class ApiGateway {
  @Route('/api/users/**')
  @ServiceRoute({ serviceName: 'user-service', stripPrefix: '/api/users', addPrefix: '/users' })
  @GatewayCircuitBreaker({ failureThreshold: 10 })
  @GatewayRateLimit({ strategy: 'sliding-window', max: 100, window: 60000 })
  userService!: ServiceProxy;

  @Route('/api/orders/**')
  @ServiceRoute({ serviceName: 'order-service' })
  @Canary({
    stable: { version: 'v1', weight: 90 },
    canary: { version: 'v2', weight: 10 },
    promotion: {
      strategy: 'error-rate',
      errorThreshold: 5,
      evaluationWindow: '5m',
      autoPromote: true,
      autoRollback: true,
      steps: [10, 25, 50, 75, 100],
      stepInterval: '10m',
    },
  })
  orderService!: ServiceProxy;
}

const gateway = GatewayServer.fromClass(ApiGateway);
gateway.startCanaries();
```

## Canary Deployment Flow

When you deploy a new version, the gateway automatically:

1. Starts routing 10% of traffic to the canary
2. Monitors error rates over a 5-minute window
3. If errors stay below 5%, promotes to 25% → 50% → 75% → 100%
4. If errors exceed 5% at any step, immediately rolls back to 0%

```
Deploy v2 → 10% canary → [healthy?] → 25% → 50% → 75% → 100% ✓
                              ↓
                         [errors > 5%] → Rollback to 0% ✗
```

### Listen to canary events:

```typescript
gateway.on('canary:promote', (data) => {
  console.log(`Step ${data.step}: canary at ${data.canaryWeight}%`);
});

gateway.on('canary:rollback', (data) => {
  console.log(`Rolled back: ${data.canaryVersion} (trigger: ${data.trigger})`);
});

gateway.on('canary:complete', (data) => {
  console.log(`${data.version} is now at 100%`);
});
```

## Version Routing Strategies

| Strategy | How It Works | Example |
|----------|-------------|---------|
| Header | Client sends `X-API-Version: v2` | Opt-in for specific clients |
| URI | Path prefix `/v2/api/users` | RESTful versioning |
| Query | `?version=v2` | Quick testing |
| Weighted | Percentage-based random | A/B testing, canary |

## HazelJS Core Integration

Use the gateway with HazelApp's built-in HTTP server:

```typescript
import { HazelApp } from '@hazeljs/core';
import { GatewayServer, createGatewayHandler } from '@hazeljs/gateway';

const gateway = GatewayServer.fromConfig(config);
gateway.startCanaries();

const app = new HazelApp(AppModule);
app.addProxyHandler('/api', createGatewayHandler(gateway));
app.listen(3000);
```

`addProxyHandler(pathPrefix, handler)` runs after body parsing and before the router. Requests matching the path prefix are forwarded to the gateway.

## Programmatic API

```typescript
const gateway = new GatewayServer({
  discovery: { cacheEnabled: true },
  metrics: { enabled: true },
});

gateway.addRoute({
  path: '/api/users/**',
  serviceName: 'user-service',
  circuitBreaker: { failureThreshold: 5 },
});

const response = await gateway.handleRequest({
  method: 'GET',
  path: '/api/users/123',
  headers: {},
});
```

## Environment Variable Convention

| Prefix | Scope | Example |
|--------|-------|---------|
| `GATEWAY_*` | Global gateway settings | `GATEWAY_DEFAULT_TIMEOUT=5000` |
| `GATEWAY_CB_*` | Default circuit breaker | `GATEWAY_CB_THRESHOLD=5` |
| `<SERVICE>_SVC_*` | Per-service overrides | `USER_SVC_RATE_LIMIT_MAX=100` |
| `<SERVICE>_CANARY_*` | Canary deployment | `ORDER_CANARY_ERROR_THRESHOLD=5` |
| `<SERVICE>_VERSION_*` | Version routing | `PAYMENT_DEFAULT_VERSION=v1` |

## License

MIT
