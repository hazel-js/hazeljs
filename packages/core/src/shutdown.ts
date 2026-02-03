/**
 * Graceful Shutdown Manager
 * Handles SIGTERM, SIGINT signals and ensures clean shutdown
 */

import logger from './logger';

export interface ShutdownHandler {
  name: string;
  handler: () => Promise<void>;
  timeout?: number;
}

export class ShutdownManager {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private shutdownTimeout = 30000; // 30 seconds default

  constructor(timeout?: number) {
    if (timeout) {
      this.shutdownTimeout = timeout;
    }
  }

  /**
   * Register a shutdown handler
   */
  registerHandler(handler: ShutdownHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal} signal, starting graceful shutdown...`);
        await this.shutdown(signal);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught Exception:', {
        error: error.message,
        stack: error.stack,
      });
      await this.shutdown('UNCAUGHT_EXCEPTION');
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled Rejection:', {
        reason,
        promise,
      });
      await this.shutdown('UNHANDLED_REJECTION');
      process.exit(1);
    });
  }

  /**
   * Perform graceful shutdown
   */
  async shutdown(_signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown...');

    // Set a timeout to force shutdown if handlers take too long
    const forceShutdownTimer = setTimeout(() => {
      logger.error(`Shutdown timeout (${this.shutdownTimeout}ms) exceeded, forcing exit`);
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      // Execute all shutdown handlers
      for (const { name, handler, timeout } of this.handlers) {
        logger.info(`Executing shutdown handler: ${name}`);
        
        try {
          if (timeout) {
            await Promise.race([
              handler(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Handler ${name} timeout`)), timeout)
              ),
            ]);
          } else {
            await handler();
          }
          logger.info(`Shutdown handler completed: ${name}`);
        } catch (error) {
          logger.error(`Error in shutdown handler ${name}:`, error);
        }
      }

      logger.info('Graceful shutdown completed successfully');
      clearTimeout(forceShutdownTimer);
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      clearTimeout(forceShutdownTimer);
      process.exit(1);
    }
  }

  /**
   * Get shutdown status
   */
  isShutdown(): boolean {
    return this.isShuttingDown;
  }
}
