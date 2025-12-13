/**
 * Service Discovery Types
 */

export interface ServiceInstance {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol?: 'http' | 'https' | 'grpc';
  metadata?: Record<string, unknown>;
  healthCheckPath?: string;
  healthCheckInterval?: number;
  zone?: string;
  tags?: string[];
  status: ServiceStatus;
  lastHeartbeat: Date;
  registeredAt: Date;
}

export enum ServiceStatus {
  UP = 'UP',
  DOWN = 'DOWN',
  STARTING = 'STARTING',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
  UNKNOWN = 'UNKNOWN',
}

export interface ServiceRegistryConfig {
  name: string;
  host?: string;
  port: number;
  protocol?: 'http' | 'https' | 'grpc';
  healthCheckPath?: string;
  healthCheckInterval?: number;
  metadata?: Record<string, unknown>;
  zone?: string;
  tags?: string[];
  backend?: 'memory' | 'redis' | 'consul' | 'etcd' | 'kubernetes';
  backendConfig?: Record<string, unknown>;
}

export interface DiscoveryClientConfig {
  backend?: 'memory' | 'redis' | 'consul' | 'etcd' | 'kubernetes';
  backendConfig?: Record<string, unknown>;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  refreshInterval?: number;
}

export interface LoadBalancerStrategy {
  name: string;
  choose(instances: ServiceInstance[]): ServiceInstance | null;
}

export interface HealthCheckResult {
  status: ServiceStatus;
  message?: string;
  timestamp: Date;
}

export interface ServiceFilter {
  zone?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  status?: ServiceStatus;
}
