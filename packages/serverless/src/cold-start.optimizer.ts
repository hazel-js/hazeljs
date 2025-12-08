import logger from '@hazeljs/core';
import { Container } from '@hazeljs/core';

/**
 * Cold start optimization strategies
 */
export class ColdStartOptimizer {
  private static instance: ColdStartOptimizer;
  private isWarmedUp = false;
  private warmupTimestamp?: number;
  private preloadedModules: Set<string> = new Set();

  private constructor() {}

  static getInstance(): ColdStartOptimizer {
    if (!ColdStartOptimizer.instance) {
      ColdStartOptimizer.instance = new ColdStartOptimizer();
    }
    return ColdStartOptimizer.instance;
  }

  /**
   * Warm up the application
   */
  async warmUp(): Promise<void> {
    if (this.isWarmedUp) {
      logger.debug('Application already warmed up');
      return;
    }

    const startTime = Date.now();
    logger.info('Starting cold start optimization...');

    try {
      // Pre-initialize container
      await this.preInitializeContainer();

      // Preload critical modules
      await this.preloadCriticalModules();

      // Setup connection pools
      await this.setupConnectionPools();

      this.isWarmedUp = true;
      this.warmupTimestamp = Date.now();

      const duration = Date.now() - startTime;
      logger.info(`Cold start optimization completed in ${duration}ms`);
    } catch (error) {
      logger.error('Cold start optimization failed:', error);
      throw error;
    }
  }

  /**
   * Pre-initialize the DI container
   */
  private async preInitializeContainer(): Promise<void> {
    logger.debug('Pre-initializing DI container...');
    Container.getInstance();
    // Container is already initialized, just log it
    logger.debug('DI container ready');
  }

  /**
   * Preload critical modules
   */
  private async preloadCriticalModules(): Promise<void> {
    logger.debug('Preloading critical modules...');

    const criticalModules = ['http', 'https', 'crypto', 'buffer'];

    for (const moduleName of criticalModules) {
      try {
        await import(moduleName);
        this.preloadedModules.add(moduleName);
        logger.debug(`Preloaded module: ${moduleName}`);
      } catch (error) {
        logger.warn(`Failed to preload module ${moduleName}:`, error);
      }
    }
  }

  /**
   * Setup connection pools
   */
  private async setupConnectionPools(): Promise<void> {
    logger.debug('Setting up connection pools...');
    // Connection pools would be initialized here
    // For now, just a placeholder
  }

  /**
   * Check if the application is warmed up
   */
  isWarm(): boolean {
    return this.isWarmedUp;
  }

  /**
   * Get warmup timestamp
   */
  getWarmupTimestamp(): number | undefined {
    return this.warmupTimestamp;
  }

  /**
   * Get warmup duration
   */
  getWarmupDuration(): number | undefined {
    if (!this.warmupTimestamp) return undefined;
    return Date.now() - this.warmupTimestamp;
  }

  /**
   * Reset warmup state (for testing)
   */
  reset(): void {
    this.isWarmedUp = false;
    this.warmupTimestamp = undefined;
    this.preloadedModules.clear();
  }

  /**
   * Get preloaded modules
   */
  getPreloadedModules(): string[] {
    return Array.from(this.preloadedModules);
  }
}

/**
 * Decorator to enable cold start optimization for a method
 */
export function OptimizeColdStart(): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const optimizer = ColdStartOptimizer.getInstance();

      if (!optimizer.isWarm()) {
        await optimizer.warmUp();
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Keep-alive helper to prevent cold starts
 */
export class KeepAliveHelper {
  private intervalId?: NodeJS.Timeout;
  private pingUrl?: string;

  /**
   * Start keep-alive pings
   */
  start(url: string, intervalMs: number = 5 * 60 * 1000): void {
    this.pingUrl = url;

    this.intervalId = setInterval(async () => {
      try {
        logger.debug(`Sending keep-alive ping to ${url}`);
        // In a real implementation, you would make an HTTP request here
        // For now, just log it
      } catch (error) {
        logger.error('Keep-alive ping failed:', error);
      }
    }, intervalMs);

    logger.info(`Keep-alive started for ${url} (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop keep-alive pings
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('Keep-alive stopped');
    }
  }
}
