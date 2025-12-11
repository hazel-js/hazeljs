# Service Discovery Examples

This directory demonstrates HazelJS's service discovery and registry capabilities, inspired by Netflix Eureka.

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

The in-memory example includes:
- **User Service** (Port 3001) - Manages user data
- **Order Service** (Port 3002) - Manages orders, discovers and calls User Service
- **API Gateway** (Port 3003) - Routes requests to services with load balancing

## Features Demonstrated

1. **Service Registration** - Automatic registration with health checks
2. **Service Discovery** - Find and connect to other services
3. **Load Balancing** - Multiple strategies (Round Robin, Random, etc.)
4. **Health Checks** - Automatic health monitoring
5. **Service Filtering** - Filter by zone, tags, metadata
6. **Decorators** - Clean integration with HazelJS

## Running the Example

### Quick Start (Recommended)

Run all services and tests automatically:
```bash
cd example
./src/microservices/run-demo.sh
```

This will:
1. Start all three services
2. Run automated tests
3. Keep services running for manual testing
4. Clean up on Ctrl+C

### Manual Start (Individual Services)

**Terminal 1 - User Service:**
```bash
npm run microservices:user
```

**Terminal 2 - Order Service:**
```bash
npm run microservices:order
```

**Terminal 3 - API Gateway:**
```bash
npm run microservices:gateway
```

### Test the Services

**Create a user:**
```bash
curl -X POST http://localhost:3003/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

**Get user:**
```bash
curl http://localhost:3003/users/1
```

**Create an order (calls User Service internally):**
```bash
curl -X POST http://localhost:3003/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": "1", "items": ["item1", "item2"], "total": 99.99}'
```

**Get order:**
```bash
curl http://localhost:3003/orders/1
```

## Architecture

```
┌─────────────────┐
│   API Gateway   │ :3003
│  (Load Balancer)│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼────┐ ┌──▼──────┐
│  User  │ │  Order  │
│Service │ │ Service │
│  :3001 │ │  :3002  │
└────────┘ └─────────┘
              │
              │ (discovers)
              ▼
         ┌─────────┐
         │  User   │
         │ Service │
         └─────────┘
```

## Service Discovery Flow

1. **User Service** starts and registers itself
2. **Order Service** starts, registers itself, and discovers User Service
3. **API Gateway** discovers both services and load balances requests
4. Services send heartbeats to maintain registration
5. Failed services are automatically removed

## Load Balancing Strategies

The example demonstrates different strategies:

- **Round Robin** - Distributes requests evenly
- **Random** - Random selection
- **Least Connections** - Routes to least busy instance
- **Zone Aware** - Prefers same-zone instances

## Health Checks

Each service exposes a `/health` endpoint that returns:
```json
{
  "status": "UP",
  "timestamp": "2025-12-11T00:00:00.000Z",
  "service": "user-service",
  "uptime": 12345
}
```

## Service Metadata

Services can include metadata for filtering:
```typescript
{
  version: '1.0.0',
  zone: 'us-east-1',
  tags: ['api', 'production'],
  environment: 'production'
}
```

## Scaling

To demonstrate load balancing, start multiple instances:

```bash
# Terminal 1
PORT=3001 npm run start:user-service

# Terminal 2
PORT=3004 npm run start:user-service

# Terminal 3
PORT=3005 npm run start:user-service
```

The gateway will automatically discover and load balance across all instances.
