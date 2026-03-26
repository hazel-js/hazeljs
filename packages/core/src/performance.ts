import { Request } from './types';
import logger from './logger';

export interface PerformanceMetrics {
  requestId: string;
  method: string;
  path: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  error?: Error;
}

export interface PerformanceHook {
  name: string;
  onRequest?: (metrics: PerformanceMetrics) => void | Promise<void>;
  onResponse?: (metrics: PerformanceMetrics) => void | Promise<void>;
  onError?: (metrics: PerformanceMetrics) => void | Promise<void>;
}

export interface PerformanceOptions {
  enableMetrics?: boolean;
  slowRequestThreshold?: number;
  maxRequestsWindow?: number;
  rateLimitWindow?: number;
}

export class PerformanceMonitor {
  private hooks: PerformanceHook[] = [];
  private activeRequests: Map<string, PerformanceMetrics> = new Map();

  constructor() {
    logger.debug('PerformanceMonitor initialized');
  }

  addHook(hook: PerformanceHook): void {
    this.hooks.push(hook);
    logger.debug(`Added performance hook: ${hook.name}`);
  }

  removeHook(name: string): void {
    this.hooks = this.hooks.filter(hook => hook.name !== name);
    logger.debug(`Removed performance hook: ${name}`);
  }

  startRequest(req: Request): string {
    const requestId = this.generateRequestId();
    const metrics: PerformanceMetrics = {
      requestId,
      method: req.method || 'GET',
      path: req.url || '/',
      startTime: Date.now(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };

    this.activeRequests.set(requestId, metrics);

    // Execute request hooks
    this.executeHooks('onRequest', metrics);

    return requestId;
  }

  endRequest(requestId: string, statusCode: number, error?: Error): void {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) return;

    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.statusCode = statusCode;
    metrics.error = error;

    // Execute response or error hooks
    if (error) {
      this.executeHooks('onError', metrics);
    } else {
      this.executeHooks('onResponse', metrics);
    }

    this.activeRequests.delete(requestId);
  }

  getActiveRequests(): PerformanceMetrics[] {
    return Array.from(this.activeRequests.values());
  }

  getMetrics(): {
    activeRequests: number;
    totalHooks: number;
    averageResponseTime?: number;
  } {
    return {
      activeRequests: this.activeRequests.size,
      totalHooks: this.hooks.length,
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async executeHooks(
    hookType: 'onRequest' | 'onResponse' | 'onError',
    metrics: PerformanceMetrics
  ): Promise<void> {
    const promises = this.hooks
      .filter(hook => hook[hookType])
      .map(async hook => {
        try {
          await hook[hookType]!(metrics);
        } catch (error) {
          logger.error(`Error in performance hook ${hook.name}:`, error);
        }
      });

    await Promise.allSettled(promises);
  }
}

// Built-in performance hooks
export const BuiltinPerformanceHooks = {
  // Log slow requests
  slowRequestLogger: (threshold: number = 1000): PerformanceHook => ({
    name: 'slow-request-logger',
    onResponse: (metrics): void => {
      if (metrics.duration && metrics.duration > threshold) {
        logger.warn(
          `Slow request detected: ${metrics.method} ${metrics.path} took ${metrics.duration}ms`
        );
      }
    },
  }),

  // Memory usage monitoring
  memoryMonitor: (): PerformanceHook => ({
    name: 'memory-monitor',
    onRequest: (metrics): void => {
      const memUsage = metrics.memoryUsage!;
      if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
        logger.warn(
          `High memory usage during request ${metrics.requestId}: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
        );
      }
    },
  }),

  // Request rate limiting
  rateLimiter: (maxRequests: number = 100, windowMs: number = 60000): PerformanceHook => {
    const requests: number[] = [];
    
    return {
      name: 'rate-limiter',
      onRequest: (_metrics): void => {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Remove old requests
        while (requests.length > 0 && requests[0] < windowStart) {
          requests.shift();
        }
        
        requests.push(now);
        
        if (requests.length > maxRequests) {
          logger.warn(
            `Rate limit exceeded: ${requests.length} requests in ${windowMs}ms`
          );
        }
      },
    };
  },

  // Performance metrics collector
  metricsCollector: (): PerformanceHook => {
    const metrics: PerformanceMetrics[] = [];
    
    return {
      name: 'metrics-collector',
      onResponse: (metricsData): void => {
        metrics.push(metricsData);
        
        // Keep only last 1000 metrics
        if (metrics.length > 1000) {
          metrics.splice(0, 100);
        }
        
        // Calculate average response time
        const avgTime = metrics.reduce((sum, m) => sum + (m.duration || 0), 0) / metrics.length;
        
        if (metrics.length % 100 === 0) {
          logger.debug(
            `Performance metrics - Avg response time: ${Math.round(avgTime)}ms, Requests: ${metrics.length}`
          );
        }
      },
    };
  },
};
