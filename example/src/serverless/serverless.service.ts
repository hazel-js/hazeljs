import { Injectable } from '@hazeljs/core';
import { ColdStartOptimizer } from '@hazeljs/serverless';

/**
 * Serverless service for handling serverless-specific logic
 */
@Injectable()
export class ServerlessService {
  private coldStartDetected = true;
  private requestCount = 0;
  private startTime = Date.now();
  private optimizer: ColdStartOptimizer;

  constructor() {
    this.optimizer = ColdStartOptimizer.getInstance();
  }

  /**
   * Check if this is a cold start
   */
  isColdStart(): boolean {
    const isCold = this.coldStartDetected;
    this.coldStartDetected = false;
    return isCold;
  }

  /**
   * Get serverless statistics
   */
  getStats() {
    this.requestCount++;

    return {
      requestCount: this.requestCount,
      uptime: Date.now() - this.startTime,
      isWarm: this.optimizer.isWarm(),
      warmupDuration: this.optimizer.getWarmupDuration(),
      preloadedModules: this.optimizer.getPreloadedModules(),
    };
  }

  /**
   * Process data
   */
  async processData(data: any): Promise<any> {
    this.requestCount++;

    // Simulate some processing
    await new Promise((resolve) => setTimeout(resolve, 10));

    return {
      processed: true,
      input: data,
      processedAt: new Date().toISOString(),
      requestNumber: this.requestCount,
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      totalRequests: this.requestCount,
      uptimeMs: Date.now() - this.startTime,
      averageRequestTime:
        this.requestCount > 0 ? (Date.now() - this.startTime) / this.requestCount : 0,
      memoryUsage: process.memoryUsage(),
      isWarm: this.optimizer.isWarm(),
    };
  }

  /**
   * Health check
   */
  checkHealth() {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    return {
      healthy: heapUsedPercent < 90,
      uptime: Date.now() - this.startTime,
      requestCount: this.requestCount,
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsedPercent: Math.round(heapUsedPercent),
      },
      isWarm: this.optimizer.isWarm(),
    };
  }

  /**
   * Reset statistics (for testing)
   */
  reset(): void {
    this.coldStartDetected = true;
    this.requestCount = 0;
    this.startTime = Date.now();
  }
}
