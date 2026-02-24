# @hazeljs/discovery

Service Discovery and Registry for HazelJS microservices - inspired by Netflix Eureka and Consul.

[![npm version](https://img.shields.io/npm/v/@hazeljs/discovery.svg)](https://www.npmjs.com/package/@hazeljs/discovery)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/discovery)](https://www.npmjs.com/package/@hazeljs/discovery)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Service Registration & Discovery** - Automatic service registration with health checks
- **Load Balancing** - 6 built-in strategies (Round Robin, Random, Least Connections, Weighted Round Robin, IP Hash, Zone Aware)
- **Health Checks** - Automatic health monitoring with heartbeat
- **Service Filtering** - Filter by zone, tags, metadata, and status
- **Multiple Backends** - Memory (dev), Redis, Consul, Kubernetes
- **Decorator Support** - Clean integration with HazelJS apps
- **Caching** - Built-in service discovery caching with auto-refresh
- **Auto-Cleanup** - Automatic removal of expired instances
- **Smart Retries** - Only retries on transient/network errors, not client errors
- **Pluggable Logging** - Bring your own logger or use the built-in console logger
- **Config Validation** - Runtime validation of all configuration objects
- **Graceful Shutdown** - Proper cleanup of intervals, connections, and resources

## Installation

```bash
npm install @hazeljs/discovery
```

### Optional peer dependencies

Install the backend you need:

```bash
# Redis backend
npm install ioredis

# Consul backend
npm install consul

# Kubernetes backend
npm install @kubernetes/client-node
```

## Quick Start

### 1. Register a Service

```typescript
import { ServiceRegistry } from '@hazeljs/discovery';

const registry = new ServiceRegistry({
  name: 'user-service',
  port: 3000,
  host: 'localhost',
  healthCheckPath: '/health',
  healthCheckInterval: 30000,
  metadata: { version: '1.0.0' },
  zone: 'us-east-1',
  tags: ['api', 'users'],
});

await registry.register();

// On shutdown
await registry.deregister();
```

### 2. Discover Services

```typescript
import { DiscoveryClient } from '@hazeljs/discovery';

const client = new DiscoveryClient({
  cacheEnabled: true,
  cacheTTL: 30000,
  refreshInterval: 15000, // auto-refresh cache every 15s
});

// Get all instances
const instances = await client.getInstances('user-service');

// Get one instance with load balancing
const instance = await client.getInstance('user-service', 'round-robin');

// On shutdown
client.close();
```

### 3. Call Services

```typescript
import { ServiceClient } from '@hazeljs/discovery';

const serviceClient = new ServiceClient(discoveryClient, {
  serviceName: 'user-service',
  loadBalancingStrategy: 'round-robin',
  timeout: 5000,
  retries: 3,
  retryDelay: 1000,
});

// Automatic service discovery + load balancing + smart retries
const user = await serviceClient.get('/users/123');
const created = await serviceClient.post('/users', { name: 'John' });
```

### 4. With HazelJS Decorators

```typescript
import { ServiceRegistryDecorator, InjectServiceClient } from '@hazeljs/discovery';

@ServiceRegistryDecorator({
  name: 'order-service',
  port: 3001,
  healthCheckPath: '/health',
})
export class AppModule {}

@Injectable()
export class OrderService {
  constructor(
    @InjectServiceClient('user-service')
    private userClient: ServiceClient
  ) {}

  async createOrder(userId: string) {
    const user = await this.userClient.get(`/users/${userId}`);
    // ... create order
  }
}
```

## Load Balancing Strategies

### Round Robin

```typescript
const instance = await client.getInstance('service-name', 'round-robin');
```

### Random

```typescript
const instance = await client.getInstance('service-name', 'random');
```

### Least Connections

Tracks active connections per instance. When used with `ServiceClient`, connection counts are automatically incremented/decremented on each request.

```typescript
const instance = await client.getInstance('service-name', 'least-connections');
```

### Weighted Round Robin

```typescript
// Set weight in service metadata
const registry = new ServiceRegistry({
  name: 'api-service',
  port: 3000,
  metadata: { weight: 5 }, // Higher weight = more traffic
});
```

### IP Hash (Sticky Sessions)

```typescript
const instance = await client.getInstance('service-name', 'ip-hash');
```

### Zone Aware

```typescript
const factory = client.getLoadBalancerFactory();
const strategy = factory.create('zone-aware', { zone: 'us-east-1' });
```

## Service Filtering

```typescript
import { ServiceStatus } from '@hazeljs/discovery';

const instances = await client.getInstances('user-service', {
  zone: 'us-east-1',
  status: ServiceStatus.UP,
  tags: ['api', 'production'],
  metadata: { version: '2.0.0' },
});
```

The `applyServiceFilter` utility is also exported for use in custom backends or application code:

```typescript
import { applyServiceFilter } from '@hazeljs/discovery';

const filtered = applyServiceFilter(instances, { zone: 'us-east-1' });
```

## Registry Backends

### Memory (Development)

The default backend. Stores everything in-process memory -- suitable for development and testing.

```typescript
import { MemoryRegistryBackend } from '@hazeljs/discovery';

const backend = new MemoryRegistryBackend(90000); // optional expiration in ms
const registry = new ServiceRegistry(config, backend);
```

### Redis (Production)

Distributed registry using Redis with TTL-based expiration. Uses `SCAN` (not `KEYS`) for production safety and `MGET` for efficient batch lookups. Includes connection error handling with automatic reconnection support.

```bash
npm install ioredis
```

```typescript
import Redis from 'ioredis';
import { RedisRegistryBackend } from '@hazeljs/discovery';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'your-password',
});

const backend = new RedisRegistryBackend(redis, {
  keyPrefix: 'myapp:discovery:', // default: 'hazeljs:discovery:'
  ttl: 90, // seconds, default: 90
});

const registry = new ServiceRegistry(config, backend);

// On shutdown
await backend.close();
```

### Consul

Integrates with HashiCorp Consul using TTL-based health checks.

```bash
npm install consul
```

```typescript
import Consul from 'consul';
import { ConsulRegistryBackend } from '@hazeljs/discovery';

const consul = new Consul({
  host: 'localhost',
  port: 8500,
});

const backend = new ConsulRegistryBackend(consul, {
  ttl: '30s',       // TTL check interval (supports "30s", "5m", "1h")
  datacenter: 'dc1',
});

const registry = new ServiceRegistry(config, backend);

// On shutdown
await backend.close();
```

### Kubernetes

Read-only discovery backend that integrates with Kubernetes Endpoints API. Registration, deregistration, heartbeat, and status updates are no-ops since Kubernetes manages these through its own primitives (Services, Endpoints, probes).

```bash
npm install @kubernetes/client-node
```

```typescript
import { KubeConfig } from '@kubernetes/client-node';
import { KubernetesRegistryBackend } from '@hazeljs/discovery';

const kubeConfig = new KubeConfig();
kubeConfig.loadFromDefault();

const backend = new KubernetesRegistryBackend(kubeConfig, {
  namespace: 'default',
  labelSelector: 'app.kubernetes.io/managed-by=hazeljs',
});

// Use the backend for service discovery only
const client = new DiscoveryClient({}, backend);
```

## Smart Retry Logic

`ServiceClient` only retries on transient errors. Client errors (4xx) are thrown immediately without wasting retries:

| Error Type | Retried? |
|---|---|
| Network errors (ECONNREFUSED, timeout) | Yes |
| 502 Bad Gateway | Yes |
| 503 Service Unavailable | Yes |
| 504 Gateway Timeout | Yes |
| 408 Request Timeout | Yes |
| 429 Too Many Requests | Yes |
| 400 Bad Request | No |
| 401 Unauthorized | No |
| 403 Forbidden | No |
| 404 Not Found | No |
| Other 4xx | No |

## Custom Logging

By default, the package logs to the console with a `[discovery]` prefix. You can plug in your own logger (e.g., Winston, Pino, Bunyan):

```typescript
import { DiscoveryLogger } from '@hazeljs/discovery';

DiscoveryLogger.setLogger({
  debug: (msg, ...args) => myLogger.debug(msg, ...args),
  info: (msg, ...args) => myLogger.info(msg, ...args),
  warn: (msg, ...args) => myLogger.warn(msg, ...args),
  error: (msg, ...args) => myLogger.error(msg, ...args),
});

// Reset to default console logger
DiscoveryLogger.resetLogger();
```

## Config Validation

All configuration objects are validated at construction time. Invalid configs throw a `ConfigValidationError` with a descriptive message:

```typescript
import { ServiceRegistry, ConfigValidationError } from '@hazeljs/discovery';

try {
  const registry = new ServiceRegistry({
    name: '',     // invalid: empty string
    port: -1,     // invalid: negative port
  });
} catch (error) {
  if (error instanceof ConfigValidationError) {
    console.error(error.message);
    // => 'ServiceRegistryConfig: "name" is required and must be a non-empty string'
  }
}
```

## API Reference

### ServiceRegistry

```typescript
class ServiceRegistry {
  constructor(config: ServiceRegistryConfig, backend?: RegistryBackend);
  register(): Promise<void>;
  deregister(): Promise<void>;
  getInstance(): ServiceInstance | null;
  getBackend(): RegistryBackend;
}
```

### DiscoveryClient

```typescript
class DiscoveryClient {
  constructor(config?: DiscoveryClientConfig, backend?: RegistryBackend);
  getInstances(serviceName: string, filter?: ServiceFilter): Promise<ServiceInstance[]>;
  getInstance(serviceName: string, strategy?: string, filter?: ServiceFilter): Promise<ServiceInstance | null>;
  getAllServices(): Promise<string[]>;
  clearCache(serviceName?: string): void;
  getLoadBalancerFactory(): LoadBalancerFactory;
  close(): void;
}
```

### ServiceClient

```typescript
class ServiceClient {
  constructor(discoveryClient: DiscoveryClient, config: ServiceClientConfig);
  get<T>(path: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  post<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  put<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  delete<T>(path: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  patch<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
}
```

### Configuration Types

```typescript
interface ServiceRegistryConfig {
  name: string;
  port: number;
  host?: string;
  protocol?: 'http' | 'https' | 'grpc';
  healthCheckPath?: string;       // default: '/health'
  healthCheckInterval?: number;   // default: 30000 (ms)
  metadata?: Record<string, unknown>;
  zone?: string;
  tags?: string[];
}

interface DiscoveryClientConfig {
  cacheEnabled?: boolean;
  cacheTTL?: number;           // default: 30000 (ms)
  refreshInterval?: number;    // auto-refresh cache interval (ms)
}

interface ServiceClientConfig {
  serviceName: string;
  loadBalancingStrategy?: string;  // default: 'round-robin'
  filter?: ServiceFilter;
  timeout?: number;                // default: 5000 (ms)
  retries?: number;                // default: 3
  retryDelay?: number;             // default: 1000 (ms)
}
```

## Examples

See the [examples](./examples) directory for complete working examples.

## Testing

```bash
npm test
```

The package includes 145+ unit tests across 9 test suites with 85%+ code coverage.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

Apache 2.0 &copy; [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Roadmap](../../ROADMAP_2.0.md)
