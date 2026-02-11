# Microservices Examples

This directory demonstrates HazelJS's microservices capabilities: service discovery, an intelligent API gateway with config-driven routing, canary deployments, version routing, circuit breaking, and rate limiting.

## Examples

### 1. **In-Memory Example** (Current Directory)
- All services run in **one process**
- Shared in-memory registry
- Best for: Development, testing, learning

### 2. **Redis Example** (`redis-example/`)
- Services run in **separate processes**
- Redis as distributed registry
- Best for: Production, distributed systems
- [See Redis Example README](./redis-example/README.md)

## Overview

| Service | Port | Description |
|---------|------|-------------|
| **User Service** | 3001 | Manages user data |
| **Order Service** | 3002 | Manages orders, discovers and calls User Service |
| **API Gateway** | 3003 | Config-driven routing, canary deployments, circuit breaking, rate limiting |

## Features Demonstrated

### Service Discovery (`@hazeljs/discovery`)
- Service registration with health checks
- Automatic discovery of other services
- Load balancing (Round Robin, Random, Least Connections, Zone Aware)
- Service filtering by zone, tags, metadata

### Resilience (`@hazeljs/resilience`)
- Circuit breaker protection per route
- Retry with exponential/linear backoff
- Timeout enforcement
- Bulkhead concurrency limiting
- Rate limiting (token bucket, sliding window)

### API Gateway (`@hazeljs/gateway`)
- **Config-driven routes** — All route definitions come from `gateway.config.ts` + env vars
- **Canary deployments** — Gradual traffic shifting with error-rate monitoring and auto-rollback
- **Version routing** — Route by `X-API-Version` header, URI, query param, or weighted random
- **Circuit breaker** — Per-route circuit breaker with configurable thresholds
- **Rate limiting** — Per-route rate limits
- **Traffic mirroring** — Shadow traffic to test new service versions

## Running the Example

### Quick Start (Recommended)

Run all services in a single process:
```bash
cd example
npm run microservices:demo
```

### Manual Start (Individual Services)

**Terminal 1 — User Service:**
```bash
npm run microservices:user
```

**Terminal 2 — Order Service:**
```bash
npm run microservices:order
```

**Terminal 3 — API Gateway:**
```bash
npm run microservices:gateway
```

## Test the Gateway

### Via API Gateway (config-driven routes)

**Create a user** (routed to `user-service`, protected by circuit breaker + rate limit):
```bash
curl -X POST http://localhost:3003/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

**Get user:**
```bash
curl http://localhost:3003/api/users/1
```

**Create an order** (routed to `order-service`, canary deployment active):
```bash
curl -X POST http://localhost:3003/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": "1", "items": ["item1", "item2"], "total": 99.99}'
```

**Request a specific API version** (payment-service v2 via header):
```bash
curl http://localhost:3003/api/payments/charge \
  -H "X-API-Version: v2"
```

### Gateway Info Endpoints

**View gateway routes** (shows all config-driven route details):
```bash
curl http://localhost:3003/gateway/routes
```

**Health check:**
```bash
curl http://localhost:3003/health
```

## Config-Driven Gateway

The gateway reads **all** its settings from environment variables via a config loader. No route definitions are hardcoded in decorators.

### How it works

```
.env  →  gateway.config.ts  →  ConfigService  →  GatewayServer.fromConfig()
```

1. **`gateway.config.ts`** — A config loader function that reads env vars with sensible defaults
2. **`ConfigModule.forRoot({ load: [gatewayConfig] })`** — Registers the loader with `@hazeljs/config`
3. **`GatewayServer.fromConfig(config)`** — Creates the gateway from the resolved config

### Changing behavior without code changes

Set env vars to tune the gateway per environment:

```bash
# Canary deployment — increase canary traffic
ORDER_CANARY_WEIGHT=20

# Canary — stricter error threshold
ORDER_CANARY_ERROR_THRESHOLD=2

# Rate limit — allow more requests
USER_SVC_RATE_LIMIT_MAX=500

# Circuit breaker — more sensitive
GATEWAY_CB_THRESHOLD=3

# Version routing — shift traffic to v2
PAYMENT_V2_WEIGHT=50
```

### Environment Variable Convention

| Prefix | Scope | Example |
|--------|-------|---------|
| `GATEWAY_*` | Global gateway settings | `GATEWAY_DEFAULT_TIMEOUT=5000` |
| `GATEWAY_CB_*` | Default circuit breaker | `GATEWAY_CB_THRESHOLD=5` |
| `<SERVICE>_SVC_*` | Per-service overrides | `USER_SVC_RATE_LIMIT_MAX=100` |
| `<SERVICE>_CANARY_*` | Canary deployment | `ORDER_CANARY_ERROR_THRESHOLD=5` |
| `<SERVICE>_VERSION_*` | Version routing | `PAYMENT_DEFAULT_VERSION=v1` |

See `.env` and `gateway.config.ts` for the full list.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  API Gateway :3003                   │
│  ┌──────────┐  ┌─────────┐  ┌───────┐  ┌────────┐  │
│  │ Circuit  │  │  Rate   │  │Canary │  │Version │  │
│  │ Breaker  │  │ Limiter │  │Engine │  │Router  │  │
│  └──────────┘  └─────────┘  └───────┘  └────────┘  │
│         gateway.config.ts (env vars)                │
└──────────────────┬──────────────────┬───────────────┘
                   │                  │
         ┌─────────┘                  └─────────┐
         │                                      │
┌────────▼───────┐                   ┌──────────▼─────┐
│  User Service  │                   │ Order Service  │
│     :3001      │                   │     :3002      │
│ (v1, CB + RL)  │                   │ (v1→v2 canary) │
└────────────────┘                   └────────┬───────┘
                                              │
                                     (discovers & calls)
                                              │
                                     ┌────────▼───────┐
                                     │  User Service  │
                                     └────────────────┘
```

## Canary Deployment Flow

When you deploy order-service v2, the gateway automatically:

1. Starts routing 10% of traffic to the canary (configurable via `ORDER_CANARY_WEIGHT`)
2. Monitors error rates over a 5-minute window (`ORDER_CANARY_EVAL_WINDOW`)
3. If errors stay below 5% (`ORDER_CANARY_ERROR_THRESHOLD`), promotes through steps: 10% → 25% → 50% → 75% → 100%
4. If errors exceed the threshold at any step, immediately rolls back to 0%

```
Deploy v2 → 10% canary → [healthy?] → 25% → 50% → 75% → 100% ✓
                              ↓
                         [errors > 5%] → Rollback to 0% ✗
```

## Service Discovery Flow

1. **User Service** starts and registers itself
2. **Order Service** starts, registers itself, and discovers User Service
3. **API Gateway** reads route config from env vars, discovers services, and load balances requests
4. Services send heartbeats to maintain registration
5. Failed services are automatically removed

## Health Checks

Each service exposes a `/health` endpoint:
```json
{
  "status": "UP",
  "timestamp": "2026-01-15T00:00:00.000Z",
  "service": "user-service",
  "uptime": 12345
}
```

## Scaling

To demonstrate load balancing, start multiple instances:

```bash
# Terminal 1
PORT=3001 npm run microservices:user

# Terminal 2
PORT=3004 ZONE=us-west-2 npm run microservices:user

# Terminal 3
PORT=3005 ZONE=eu-west-1 npm run microservices:user
```

The gateway will automatically discover and load balance across all instances.
