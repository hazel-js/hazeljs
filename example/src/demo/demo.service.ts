import { Injectable } from '@hazeljs/core';
import { Scope } from '@hazeljs/core';
import { ConfigService } from '@hazeljs/config';

/**
 * Demo service showcasing request-scoped providers
 */
@Injectable({ scope: Scope.REQUEST })
export class DemoService {
  private requestId: string;

  constructor(private config: ConfigService) {
    // Each request gets a unique instance with its own requestId
    this.requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the unique request ID for this instance
   */
  getRequestId(): string {
    return this.requestId;
  }

  /**
   * Get configuration values
   */
  getConfig() {
    return {
      nodeEnv: this.config.get('NODE_ENV', 'development'),
      port: this.config.get('PORT', 3000),
      // Don't expose sensitive data in real apps
      hasDbUrl: !!this.config.get('DATABASE_URL'),
    };
  }
}
