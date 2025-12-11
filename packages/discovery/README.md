# @hazeljs/discovery

Service Discovery and Registry for HazelJS microservices - inspired by Netflix Eureka and Consul.

[![npm version](https://img.shields.io/npm/v/@hazeljs/discovery.svg)](https://www.npmjs.com/package/@hazeljs/discovery)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔍 **Service Registration & Discovery** - Automatic service registration with health checks
- ⚖️ **Load Balancing** - 6 built-in strategies (Round Robin, Random, Least Connections, etc.)
- 🏥 **Health Checks** - Automatic health monitoring with heartbeat
- 🎯 **Service Filtering** - Filter by zone, tags, metadata, and status
- 💾 **Multiple Backends** - Memory (dev), Redis, Consul, etcd, Kubernetes
- 🎨 **Decorator Support** - Clean integration with HazelJS apps
- 📊 **Caching** - Built-in service discovery caching
- 🔄 **Auto-Cleanup** - Automatic removal of expired instances

## Installation

```bash
npm install @hazeljs/discovery
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
```

### 2. Discover Services

```typescript
import { DiscoveryClient } from '@hazeljs/discovery';

const client = new DiscoveryClient({
  cacheEnabled: true,
  cacheTTL: 30000,
});

// Get all instances
const instances = await client.getInstances('user-service');

// Get one instance with load balancing
const instance = await client.getInstance('user-service', 'round-robin');
```

### 3. Call Services

```typescript
import { ServiceClient } from '@hazeljs/discovery';

const serviceClient = new ServiceClient(discoveryClient, {
  serviceName: 'user-service',
  loadBalancingStrategy: 'round-robin',
  timeout: 5000,
  retries: 3,
});

// Automatic service discovery + load balancing
const user = await serviceClient.get('/users/123');
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
```typescript
const instance = await client.getInstance('service-name', 'least-connections');
```

### Weighted Round Robin
```typescript
// Set weight in service metadata
const registry = new ServiceRegistry({
  name: 'api-service',
  metadata: { weight: 5 }, // Higher weight = more traffic
  // ...
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
const instances = await client.getInstances('user-service', {
  zone: 'us-east-1',
  status: ServiceStatus.UP,
  tags: ['api', 'production'],
  metadata: { version: '2.0.0' },
});
```

## Registry Backends

### Memory (Development)
```typescript
import { MemoryRegistryBackend } from '@hazeljs/discovery';

const backend = new MemoryRegistryBackend();
const registry = new ServiceRegistry(config, backend);
```

### Redis (Production)
```typescript
import Redis from 'ioredis';
import { RedisRegistryBackend } from '@hazeljs/discovery';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'your-password',
});

const backend = new RedisRegistryBackend(redis, {
  keyPrefix: 'myapp:discovery:',
  ttl: 90, // seconds
});

const registry = new ServiceRegistry(config, backend);
```

### Consul
```typescript
import Consul from 'consul';
import { ConsulRegistryBackend } from '@hazeljs/discovery';

const consul = new Consul({
  host: 'localhost',
  port: 8500,
});

const backend = new ConsulRegistryBackend(consul, {
  ttl: '30s',
  datacenter: 'dc1',
});

const registry = new ServiceRegistry(config, backend);
```

### Kubernetes
```typescript
import { KubeConfig } from '@kubernetes/client-node';
import { KubernetesRegistryBackend } from '@hazeljs/discovery';

const kubeConfig = new KubeConfig();
kubeConfig.loadFromDefault();

const backend = new KubernetesRegistryBackend(kubeConfig, {
  namespace: 'default',
  labelSelector: 'app.kubernetes.io/managed-by=hazeljs',
});

// In Kubernetes, service registration is handled by the platform
// Use the backend for service discovery only
const client = new DiscoveryClient({}, backend);
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
}
```

### ServiceClient

```typescript
class ServiceClient {
  constructor(discoveryClient: DiscoveryClient, config: ServiceClientConfig);
  get<T>(path: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  post<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  put<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  delete<T>(path: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  patch<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
}
```

## Examples

See the [examples](./examples) directory for complete working examples.

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Roadmap](../../ROADMAP_2.0.md)
