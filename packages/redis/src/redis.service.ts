import { Service } from '@hazeljs/core';
import logger from '@hazeljs/core';
import type Redis from 'ioredis';
import type { RedisConnectionOptions } from './redis.types';

/**
 * Shared Redis command client for HazelJS apps
 */
@Service()
export class RedisService {
  private client: Redis | null = null;
  private ownsClient = false;

  /**
   * Configure from an existing ioredis instance
   */
  setClient(client: Redis, ownsClient = false): void {
    this.client = client;
    this.ownsClient = ownsClient;
    logger.info('RedisService client configured');
  }

  /**
   * Create and configure a new ioredis client from URL or connection options
   */
  connectFromOptions(options: { url?: string; connection?: RedisConnectionOptions }): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- ioredis is a peer dep
    const RedisCtor = require('ioredis') as new (...args: unknown[]) => Redis;
    if (options.url) {
      this.client = new RedisCtor(options.url);
    } else if (options.connection) {
      this.client = new RedisCtor(options.connection);
    } else {
      this.client = new RedisCtor();
    }
    this.ownsClient = true;
    logger.info('RedisService connected');
  }

  /**
   * Underlying ioredis client (commands / publish)
   */
  getClient(): Redis {
    if (!this.client) {
      throw new Error(
        'RedisService not configured. Call RedisModule.forRoot() or setClient()/connectFromOptions().'
      );
    }
    return this.client;
  }

  /**
   * Health check
   */
  async ping(): Promise<string> {
    return this.getClient().ping();
  }

  /**
   * Duplicate the command client (e.g. for a dedicated subscriber connection)
   */
  duplicate(): Redis {
    return this.getClient().duplicate();
  }

  /**
   * Disconnect if this service owns the client
   */
  async disconnect(): Promise<void> {
    if (this.client && this.ownsClient) {
      await this.client.quit();
      logger.info('RedisService disconnected');
    }
    this.client = null;
    this.ownsClient = false;
  }
}
