import { Injectable } from './decorators';
import logger from './logger';

@Injectable()
export abstract class BaseService {
  protected constructor() {
    logger.info(`Initializing service: ${this.constructor.name}`);
  }

  protected logError(method: string, error: Error & { stack?: string }): void {
    logger.error(`[${this.constructor.name}.${method}] Error: ${error.message}`);
    if (process.env.NODE_ENV === 'development' && error.stack) {
      logger.debug(error.stack);
    }
  }

  protected logInfo(method: string, message: string): void {
    logger.info(`[${this.constructor.name}.${method}] ${message}`);
  }

  protected logDebug(method: string, message: string, data?: unknown): void {
    logger.debug(`[${this.constructor.name}.${method}] ${message}`, data);
  }
}
