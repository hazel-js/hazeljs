# Redis Backend Example

This example demonstrates using Redis as a distributed registry backend, allowing services in **different processes** to discover each other.

## Prerequisites

1. **Redis Server** running on localhost:6379
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:alpine
   
   # Or using Homebrew (macOS)
   brew install redis
   brew services start redis
   ```

2. **Install Redis client**
   ```bash
   cd example
   npm install ioredis
   ```

## Architecture

Unlike the in-memory example where all services run in one process, this example shows:

- ✅ Services running in **separate processes**
- ✅ **Redis** as the shared registry
- ✅ Services discovering each other across processes
- ✅ Automatic TTL-based expiration
- ✅ Production-ready setup

```
┌─────────────────┐
│  Redis Server   │ :6379
│  (Registry)     │
└────────┬────────┘
         │
    ┌────┴────────────┐
    │                 │
┌───▼────┐      ┌────▼─────┐      ┌──────▼───┐
│  User  │      │  Order   │      │   API    │
│Service │      │ Service  │      │ Gateway  │
│ :3001  │      │  :3002   │      │  :3003   │
└────────┘      └──────────┘      └──────────┘
 Process 1       Process 2         Process 3
```

## Running the Example

### Option 1: All-in-One Script
```bash
cd example
npm run microservices:redis-demo
```

### Option 2: Individual Processes

**Terminal 1 - User Service:**
```bash
npm run microservices:redis-user
```

**Terminal 2 - Order Service:**
```bash
npm run microservices:redis-order
```

**Terminal 3 - API Gateway:**
```bash
npm run microservices:redis-gateway
```

## Testing

Once all services are running:

```bash
# Create a user
curl -X POST http://localhost:3003/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'

# Get user
curl http://localhost:3003/users/1

# Create an order (calls User Service from Order Service)
curl -X POST http://localhost:3003/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"1","items":["laptop"],"total":999.99}'

# Get order with user data
curl http://localhost:3003/orders/1

# View service registry
curl http://localhost:3003/services
```

## Key Differences from In-Memory Example

| Feature | In-Memory | Redis |
|---------|-----------|-------|
| **Processes** | Single process | Multiple processes |
| **Scalability** | Limited to one machine | Distributed across servers |
| **Persistence** | Lost on restart | Survives restarts (with TTL) |
| **Production Ready** | No | Yes |
| **Service Discovery** | Same process only | Cross-process/cross-server |

## Redis Keys Structure

The Redis backend uses the following key structure:

```
hazeljs:discovery:instance:{instanceId}     # Service instance data (TTL: 90s)
hazeljs:discovery:service:{serviceName}     # Set of instance IDs
```

Example:
```
hazeljs:discovery:instance:user-service:localhost:3001:123456
hazeljs:discovery:service:user-service
```

## Monitoring Redis

View registered services in Redis:
```bash
# Connect to Redis CLI
redis-cli

# View all discovery keys
KEYS hazeljs:discovery:*

# View a specific service's instances
SMEMBERS hazeljs:discovery:service:user-service

# View instance details
GET hazeljs:discovery:instance:user-service:localhost:3001:123456

# Monitor real-time commands
MONITOR
```

## Configuration

You can customize the Redis backend:

```typescript
const backend = new RedisRegistryBackend(redis, {
  keyPrefix: 'myapp:discovery:',  // Custom key prefix
  ttl: 60,                         // TTL in seconds (default: 90)
});
```

## Production Deployment

For production, consider:

1. **Redis Cluster** for high availability
2. **Redis Sentinel** for automatic failover
3. **Longer TTL** values (e.g., 120-300 seconds)
4. **Monitoring** with Redis metrics
5. **Backup** Redis data periodically

## Troubleshooting

**Services can't discover each other:**
- Check Redis is running: `redis-cli ping`
- Verify Redis connection in logs
- Check TTL hasn't expired

**Services disappearing:**
- Increase TTL value
- Check heartbeat interval
- Verify Redis memory limits

**Connection errors:**
- Check Redis host/port configuration
- Verify firewall rules
- Check Redis password if set
