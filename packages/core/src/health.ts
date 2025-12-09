/**
 * Health Check System
 * Provides /health and /readiness endpoints for monitoring
 */

import logger from './logger';

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
  critical?: boolean; // If true, failure makes service unhealthy
  timeout?: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: Record<string, unknown>;
  responseTime?: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: Record<string, HealthCheckResult>;
  version?: string;
  environment?: string;
}

export class HealthCheckManager {
  private checks: Map<string, HealthCheck> = new Map();
  private startTime: number = Date.now();

  /**
   * Register a health check
   */
  registerCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
    logger.info(`Registered health check: ${check.name}`);
  }

  /**
   * Run all health checks
   */
  async runChecks(): Promise<HealthStatus> {
    const results: Record<string, HealthCheckResult> = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    for (const [name, check] of this.checks) {
      try {
        const startTime = Date.now();
        
        // Run check with timeout
        const result = await Promise.race([
          check.check(),
          new Promise<HealthCheckResult>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Health check ${name} timeout`)),
              check.timeout || 5000
            )
          ),
        ]);

        result.responseTime = Date.now() - startTime;
        results[name] = result;

        // Update overall status
        if (result.status === 'unhealthy' && check.critical) {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        const errorResult: HealthCheckResult = {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        results[name] = errorResult;

        if (check.critical) {
          overallStatus = 'unhealthy';
        }

        logger.error(`Health check failed: ${name}`, error);
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: results,
      version: process.env.APP_VERSION,
      environment: process.env.NODE_ENV,
    };
  }

  /**
   * Get liveness status (is the service running?)
   */
  async getLiveness(): Promise<{ status: 'alive'; timestamp: string }> {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get readiness status (is the service ready to accept traffic?)
   */
  async getReadiness(): Promise<HealthStatus> {
    return this.runChecks();
  }

  /**
   * Get startup status (has the service completed startup?)
   */
  async getStartup(): Promise<{ status: 'started'; uptime: number; timestamp: string }> {
    return {
      status: 'started',
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Built-in health checks
 */
export class BuiltInHealthChecks {
  /**
   * Memory usage check
   */
  static memoryCheck(thresholdMB = 500): HealthCheck {
    return {
      name: 'memory',
      check: async (): Promise<HealthCheckResult> => {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

        if (heapUsedMB > thresholdMB) {
          return {
            status: 'degraded',
            message: `High memory usage: ${heapUsedMB.toFixed(2)}MB`,
            details: {
              heapUsed: `${heapUsedMB.toFixed(2)}MB`,
              heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
              rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`,
            },
          };
        }

        return {
          status: 'healthy',
          details: {
            heapUsed: `${heapUsedMB.toFixed(2)}MB`,
            heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
          },
        };
      },
      critical: false,
    };
  }

  /**
   * Event loop lag check
   */
  static eventLoopCheck(thresholdMs = 100): HealthCheck {
    return {
      name: 'eventLoop',
      check: async (): Promise<HealthCheckResult> => {
        const start = Date.now();
        await new Promise((resolve) => setImmediate(resolve));
        const lag = Date.now() - start;

        if (lag > thresholdMs) {
          return {
            status: 'degraded',
            message: `High event loop lag: ${lag}ms`,
            details: { lag: `${lag}ms` },
          };
        }

        return {
          status: 'healthy',
          details: { lag: `${lag}ms` },
        };
      },
      critical: false,
    };
  }

  /**
   * Disk space check (if applicable)
   */
  static diskSpaceCheck(): HealthCheck {
    return {
      name: 'diskSpace',
      check: async (): Promise<HealthCheckResult> => {
        // This is a placeholder - actual implementation would check disk space
        // using a library like 'check-disk-space'
        return {
          status: 'healthy',
          message: 'Disk space check not implemented',
        };
      },
      critical: false,
    };
  }
}
