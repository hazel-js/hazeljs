/**
 * Gateway Metrics
 * Aggregates metrics across all routes and services for observability.
 * Wraps @hazeljs/resilience MetricsCollector per route/service/version.
 */

import { MetricsCollector, MetricsSnapshot } from '@hazeljs/resilience';

export interface RouteMetricsSnapshot {
  route: string;
  serviceName: string;
  version?: string;
  metrics: MetricsSnapshot;
}

export interface GatewayMetricsSnapshot {
  timestamp: number;
  totalRoutes: number;
  routes: RouteMetricsSnapshot[];
  aggregated: MetricsSnapshot;
}

export class GatewayMetrics {
  /** route -> MetricsCollector */
  private routeMetrics = new Map<string, MetricsCollector>();
  /** route:version -> MetricsCollector */
  private versionMetrics = new Map<string, MetricsCollector>();
  private windowMs: number;

  constructor(windowMs: number = 60_000) {
    this.windowMs = windowMs;
  }

  /**
   * Get or create a metrics collector for a route
   */
  getRouteCollector(route: string): MetricsCollector {
    let collector = this.routeMetrics.get(route);
    if (!collector) {
      collector = new MetricsCollector(this.windowMs);
      this.routeMetrics.set(route, collector);
    }
    return collector;
  }

  /**
   * Get or create a metrics collector for a route+version
   */
  getVersionCollector(route: string, version: string): MetricsCollector {
    const key = `${route}:${version}`;
    let collector = this.versionMetrics.get(key);
    if (!collector) {
      collector = new MetricsCollector(this.windowMs);
      this.versionMetrics.set(key, collector);
    }
    return collector;
  }

  /**
   * Record a successful request
   */
  recordSuccess(route: string, duration: number, version?: string): void {
    this.getRouteCollector(route).recordSuccess(duration);
    if (version) {
      this.getVersionCollector(route, version).recordSuccess(duration);
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(route: string, duration: number, error?: string, version?: string): void {
    this.getRouteCollector(route).recordFailure(duration, error);
    if (version) {
      this.getVersionCollector(route, version).recordFailure(duration, error);
    }
  }

  /**
   * Get metrics for a specific route
   */
  getRouteMetrics(route: string): MetricsSnapshot | undefined {
    return this.routeMetrics.get(route)?.getSnapshot();
  }

  /**
   * Get metrics for a specific route+version
   */
  getVersionMetrics(route: string, version: string): MetricsSnapshot | undefined {
    return this.versionMetrics.get(`${route}:${version}`)?.getSnapshot();
  }

  /**
   * Get error rate for a specific route+version
   */
  getVersionErrorRate(route: string, version: string): number {
    const collector = this.versionMetrics.get(`${route}:${version}`);
    return collector ? collector.getFailureRate() : 0;
  }

  /**
   * Get a full snapshot of all gateway metrics
   */
  getSnapshot(): GatewayMetricsSnapshot {
    const routes: RouteMetricsSnapshot[] = [];

    for (const [route, collector] of this.routeMetrics) {
      routes.push({
        route,
        serviceName: route, // Will be enriched by gateway
        metrics: collector.getSnapshot(),
      });
    }

    // Aggregate all route metrics
    const aggregated = this.aggregateMetrics(routes.map((r) => r.metrics));

    return {
      timestamp: Date.now(),
      totalRoutes: routes.length,
      routes,
      aggregated,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    for (const collector of this.routeMetrics.values()) {
      collector.reset();
    }
    for (const collector of this.versionMetrics.values()) {
      collector.reset();
    }
  }

  private aggregateMetrics(snapshots: MetricsSnapshot[]): MetricsSnapshot {
    if (snapshots.length === 0) {
      return {
        totalCalls: 0,
        successCalls: 0,
        failureCalls: 0,
        failureRate: 0,
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
      };
    }

    let totalCalls = 0;
    let successCalls = 0;
    let failureCalls = 0;
    let totalResponseTime = 0;
    let minResponseTime = Infinity;
    let maxResponseTime = 0;
    let maxP50 = 0;
    let maxP95 = 0;
    let maxP99 = 0;

    for (const s of snapshots) {
      totalCalls += s.totalCalls;
      successCalls += s.successCalls;
      failureCalls += s.failureCalls;
      totalResponseTime += s.averageResponseTime * s.totalCalls;
      minResponseTime = Math.min(minResponseTime, s.minResponseTime || Infinity);
      maxResponseTime = Math.max(maxResponseTime, s.maxResponseTime);
      maxP50 = Math.max(maxP50, s.p50ResponseTime);
      maxP95 = Math.max(maxP95, s.p95ResponseTime);
      maxP99 = Math.max(maxP99, s.p99ResponseTime);
    }

    return {
      totalCalls,
      successCalls,
      failureCalls,
      failureRate: totalCalls > 0 ? (failureCalls / totalCalls) * 100 : 0,
      averageResponseTime: totalCalls > 0 ? totalResponseTime / totalCalls : 0,
      p50ResponseTime: maxP50,
      p95ResponseTime: maxP95,
      p99ResponseTime: maxP99,
      minResponseTime: minResponseTime === Infinity ? 0 : minResponseTime,
      maxResponseTime,
    };
  }
}
