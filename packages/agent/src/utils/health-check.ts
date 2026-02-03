/**
 * Health Check System
 * Monitor agent runtime health and dependencies
 */

import { LLMProvider } from '../types/llm.types';
import { RAGService } from '../types/rag.types';

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface ComponentHealth {
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  lastCheck?: number;
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: number;
  uptime: number;
  components: {
    llmProvider?: ComponentHealth;
    ragService?: ComponentHealth;
    memory?: ComponentHealth;
  };
  metrics?: {
    totalExecutions: number;
    successRate: number;
    averageLatency: number;
  };
}

export interface HealthCheckConfig {
  checkIntervalMs?: number;
  timeoutMs?: number;
}

export class HealthChecker {
  private startTime: number;
  private lastCheck?: HealthCheckResult;
  private config: Required<HealthCheckConfig>;

  constructor(config: HealthCheckConfig = {}) {
    this.startTime = Date.now();
    this.config = {
      checkIntervalMs: config.checkIntervalMs ?? 30000,
      timeoutMs: config.timeoutMs ?? 5000,
    };
  }

  /**
   * Perform a health check
   */
  async check(
    llmProvider?: LLMProvider,
    ragService?: RAGService,
    metrics?: {
      totalExecutions: number;
      successRate: number;
      averageLatency: number;
    }
  ): Promise<HealthCheckResult> {
    const components: HealthCheckResult['components'] = {};

    // Check LLM Provider
    if (llmProvider) {
      components.llmProvider = await this.checkComponent('LLM Provider', async () => {
        if (llmProvider.isAvailable) {
          return await llmProvider.isAvailable();
        }
        return true;
      });
    }

    // Check RAG Service
    if (ragService) {
      components.ragService = await this.checkComponent('RAG Service', async () => {
        if (ragService.isAvailable) {
          return await ragService.isAvailable();
        }
        return true;
      });
    }

    // Check Memory (basic check)
    components.memory = {
      status: HealthStatus.HEALTHY,
      message: 'Memory system operational',
      lastCheck: Date.now(),
    };

    // Determine overall status
    const componentStatuses = Object.values(components).map((c) => c.status);
    const overallStatus = this.determineOverallStatus(componentStatuses);

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      components,
      metrics,
    };

    this.lastCheck = result;
    return result;
  }

  /**
   * Check a single component
   */
  private async checkComponent(
    name: string,
    checkFn: () => Promise<boolean>
  ): Promise<ComponentHealth> {
    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Health check timeout')),
          this.config.timeoutMs
        );
      });

      const isHealthy = await Promise.race([checkFn(), timeoutPromise]);
      const latencyMs = Date.now() - startTime;

      return {
        status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        message: isHealthy ? `${name} is operational` : `${name} is not responding`,
        latencyMs,
        lastCheck: Date.now(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return {
        status: HealthStatus.UNHEALTHY,
        message: `${name} check failed: ${(error as Error).message}`,
        latencyMs,
        lastCheck: Date.now(),
      };
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Determine overall status from component statuses
   */
  private determineOverallStatus(statuses: HealthStatus[]): HealthStatus {
    if (statuses.every((s) => s === HealthStatus.HEALTHY)) {
      return HealthStatus.HEALTHY;
    }
    if (statuses.some((s) => s === HealthStatus.UNHEALTHY)) {
      return HealthStatus.UNHEALTHY;
    }
    return HealthStatus.DEGRADED;
  }

  /**
   * Get last health check result
   */
  getLastCheck(): HealthCheckResult | undefined {
    return this.lastCheck;
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Format health check result as string
   */
  formatResult(result: HealthCheckResult): string {
    const lines: string[] = [
      'Health Check Report',
      '===================',
      `Status: ${result.status.toUpperCase()}`,
      `Timestamp: ${new Date(result.timestamp).toISOString()}`,
      `Uptime: ${Math.floor(result.uptime / 1000)}s`,
      '',
      'Components:',
    ];

    for (const [name, health] of Object.entries(result.components)) {
      lines.push(`  ${name}:`);
      lines.push(`    Status: ${health.status}`);
      if (health.message) {
        lines.push(`    Message: ${health.message}`);
      }
      if (health.latencyMs !== undefined) {
        lines.push(`    Latency: ${health.latencyMs}ms`);
      }
    }

    if (result.metrics) {
      lines.push('');
      lines.push('Metrics:');
      lines.push(`  Total Executions: ${result.metrics.totalExecutions}`);
      lines.push(`  Success Rate: ${(result.metrics.successRate * 100).toFixed(2)}%`);
      lines.push(`  Average Latency: ${result.metrics.averageLatency.toFixed(2)}ms`);
    }

    return lines.join('\n');
  }
}
