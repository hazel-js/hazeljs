/**
 * InspectorRuntime - Global registry for gateway, discovery, resilience
 * Packages register their instances here so the Inspector can display overview data.
 *
 * @example
 * // In your app when creating a gateway:
 * import { InspectorRuntime } from '@hazeljs/inspector';
 * const gateway = GatewayServer.fromConfig(config);
 * InspectorRuntime.registerGateway(gateway);
 */

export interface GatewayOverview {
  routes: string[];
  totalRoutes: number;
  metrics?: {
    totalCalls: number;
    successCalls: number;
    failureCalls: number;
    failureRate: number;
    averageResponseTime: number;
  };
}

export interface DiscoveryOverview {
  services: string[];
  totalServices: number;
  totalInstances: number;
  instancesByService: Record<string, number>;
}

export interface ResilienceOverview {
  circuitBreakers: number;
  circuitBreakerStates: { name: string; state: string }[];
}

class InspectorRuntimeImpl {
  private gateway: {
    getRoutes: () => string[];
    getMetrics?: () => {
      getSnapshot?: () => {
        aggregated?: {
          totalCalls?: number;
          successCalls?: number;
          failureCalls?: number;
          failureRate?: number;
          averageResponseTime?: number;
        };
      };
    };
  } | null = null;
  private discovery: {
    getAllServices: () => Promise<string[]>;
    getInstances: (s: string) => Promise<unknown[]>;
  } | null = null;

  registerGateway(gw: {
    getRoutes: () => string[];
    getMetrics?: () => {
      getSnapshot?: () => {
        aggregated?: {
          totalCalls?: number;
          successCalls?: number;
          failureCalls?: number;
          failureRate?: number;
          averageResponseTime?: number;
        };
      };
    };
  }): void {
    this.gateway = gw;
  }

  registerDiscovery(client: {
    getAllServices: () => Promise<string[]>;
    getInstances: (s: string) => Promise<unknown[]>;
  }): void {
    this.discovery = client;
  }

  getGateway(): typeof this.gateway {
    return this.gateway;
  }

  getDiscovery(): typeof this.discovery {
    return this.discovery;
  }

  /** Reset for testing */
  reset(): void {
    this.gateway = null;
    this.discovery = null;
  }

  async getGatewayOverview(): Promise<GatewayOverview | null> {
    if (!this.gateway) return null;
    try {
      const routes = this.gateway.getRoutes();
      let metrics: GatewayOverview['metrics'];
      if (typeof this.gateway.getMetrics === 'function') {
        const snap = this.gateway.getMetrics()?.getSnapshot?.()?.aggregated;
        if (snap) {
          metrics = {
            totalCalls: snap.totalCalls ?? 0,
            successCalls: snap.successCalls ?? 0,
            failureCalls: snap.failureCalls ?? 0,
            failureRate: snap.failureRate ?? 0,
            averageResponseTime: snap.averageResponseTime ?? 0,
          };
        }
      }
      return { routes, totalRoutes: routes.length, metrics: metrics ?? undefined };
    } catch {
      return null;
    }
  }

  async getDiscoveryOverview(): Promise<DiscoveryOverview | null> {
    if (!this.discovery) return null;
    try {
      const services = await this.discovery.getAllServices();
      const instancesByService: Record<string, number> = {};
      let totalInstances = 0;
      for (const svc of services) {
        const instances = await this.discovery.getInstances(svc);
        const count = Array.isArray(instances) ? instances.length : 0;
        instancesByService[svc] = count;
        totalInstances += count;
      }
      return { services, totalServices: services.length, totalInstances, instancesByService };
    } catch {
      return null;
    }
  }

  async getResilienceOverview(): Promise<ResilienceOverview | null> {
    try {
      const { CircuitBreakerRegistry } = require('@hazeljs/resilience');
      const breakers = CircuitBreakerRegistry.getAll?.();
      if (!breakers || !(breakers instanceof Map)) return null;
      const circuitBreakerStates: { name: string; state: string }[] = [];
      for (const [name, breaker] of breakers) {
        const state = (breaker as { getState?: () => string }).getState?.() ?? 'unknown';
        circuitBreakerStates.push({ name, state });
      }
      return { circuitBreakers: breakers.size, circuitBreakerStates };
    } catch {
      return null;
    }
  }
}

export const InspectorRuntime = new InspectorRuntimeImpl();
