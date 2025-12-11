/**
 * Load Balancing Strategies
 */

import { ServiceInstance, LoadBalancerStrategy, ServiceStatus } from '../types';

/**
 * Base strategy that filters healthy instances
 */
abstract class BaseStrategy implements LoadBalancerStrategy {
  abstract name: string;

  protected filterHealthy(instances: ServiceInstance[]): ServiceInstance[] {
    return instances.filter((instance) => instance.status === ServiceStatus.UP);
  }

  abstract choose(instances: ServiceInstance[]): ServiceInstance | null;
}

/**
 * Round Robin Strategy
 */
export class RoundRobinStrategy extends BaseStrategy {
  name = 'round-robin';
  private currentIndex = 0;

  choose(instances: ServiceInstance[]): ServiceInstance | null {
    const healthy = this.filterHealthy(instances);
    if (healthy.length === 0) return null;

    const instance = healthy[this.currentIndex % healthy.length];
    this.currentIndex = (this.currentIndex + 1) % healthy.length;
    return instance;
  }
}

/**
 * Random Strategy
 */
export class RandomStrategy extends BaseStrategy {
  name = 'random';

  choose(instances: ServiceInstance[]): ServiceInstance | null {
    const healthy = this.filterHealthy(instances);
    if (healthy.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * healthy.length);
    return healthy[randomIndex];
  }
}

/**
 * Least Connections Strategy
 * Tracks active connections per instance
 */
export class LeastConnectionsStrategy extends BaseStrategy {
  name = 'least-connections';
  private connections = new Map<string, number>();

  choose(instances: ServiceInstance[]): ServiceInstance | null {
    const healthy = this.filterHealthy(instances);
    if (healthy.length === 0) return null;

    // Find instance with least connections
    let minConnections = Infinity;
    let selectedInstance: ServiceInstance | null = null;

    for (const instance of healthy) {
      const connections = this.connections.get(instance.id) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedInstance = instance;
      }
    }

    return selectedInstance;
  }

  incrementConnections(instanceId: string): void {
    const current = this.connections.get(instanceId) || 0;
    this.connections.set(instanceId, current + 1);
  }

  decrementConnections(instanceId: string): void {
    const current = this.connections.get(instanceId) || 0;
    this.connections.set(instanceId, Math.max(0, current - 1));
  }
}

/**
 * Weighted Round Robin Strategy
 * Uses metadata.weight for weighted selection
 */
export class WeightedRoundRobinStrategy extends BaseStrategy {
  name = 'weighted-round-robin';
  private currentIndex = 0;
  private currentWeight = 0;

  choose(instances: ServiceInstance[]): ServiceInstance | null {
    const healthy = this.filterHealthy(instances);
    if (healthy.length === 0) return null;

    // Build weighted list
    const weighted: ServiceInstance[] = [];
    for (const instance of healthy) {
      const weight = instance.metadata?.weight || 1;
      for (let i = 0; i < weight; i++) {
        weighted.push(instance);
      }
    }

    if (weighted.length === 0) return null;

    const instance = weighted[this.currentIndex % weighted.length];
    this.currentIndex = (this.currentIndex + 1) % weighted.length;
    return instance;
  }
}

/**
 * IP Hash Strategy
 * Consistent hashing based on client IP
 */
export class IPHashStrategy extends BaseStrategy {
  name = 'ip-hash';

  choose(instances: ServiceInstance[], clientIP?: string): ServiceInstance | null {
    const healthy = this.filterHealthy(instances);
    if (healthy.length === 0) return null;
    if (!clientIP) return healthy[0];

    // Simple hash function
    const hash = this.hashCode(clientIP);
    const index = Math.abs(hash) % healthy.length;
    return healthy[index];
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
}

/**
 * Zone Aware Strategy
 * Prefers instances in the same zone
 */
export class ZoneAwareStrategy extends BaseStrategy {
  name = 'zone-aware';

  constructor(private preferredZone?: string) {
    super();
  }

  choose(instances: ServiceInstance[]): ServiceInstance | null {
    const healthy = this.filterHealthy(instances);
    if (healthy.length === 0) return null;

    // Try to find instance in preferred zone
    if (this.preferredZone) {
      const sameZone = healthy.filter((i) => i.zone === this.preferredZone);
      if (sameZone.length > 0) {
        return sameZone[Math.floor(Math.random() * sameZone.length)];
      }
    }

    // Fallback to random
    return healthy[Math.floor(Math.random() * healthy.length)];
  }
}

/**
 * Load Balancer Factory
 */
export class LoadBalancerFactory {
  private strategies = new Map<string, LoadBalancerStrategy>();

  constructor() {
    this.registerDefaultStrategies();
  }

  private registerDefaultStrategies(): void {
    this.register(new RoundRobinStrategy());
    this.register(new RandomStrategy());
    this.register(new LeastConnectionsStrategy());
    this.register(new WeightedRoundRobinStrategy());
    this.register(new IPHashStrategy());
  }

  register(strategy: LoadBalancerStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  get(name: string): LoadBalancerStrategy | undefined {
    return this.strategies.get(name);
  }

  create(name: string, options?: any): LoadBalancerStrategy {
    if (name === 'zone-aware') {
      return new ZoneAwareStrategy(options?.zone);
    }

    const strategy = this.get(name);
    if (!strategy) {
      throw new Error(`Load balancing strategy '${name}' not found`);
    }
    return strategy;
  }
}
