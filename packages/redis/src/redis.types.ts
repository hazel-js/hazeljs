import type Redis from 'ioredis';

/**
 * Redis connection options (passed to ioredis, or a URL / existing client)
 */
export interface RedisConnectionOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  username?: string;
  tls?: Record<string, unknown>;
  maxRetriesPerRequest?: number | null;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
  [key: string]: unknown;
}

/**
 * Redis module configuration
 */
export interface RedisModuleOptions {
  /**
   * Connection URL (e.g. redis://localhost:6379)
   * Takes precedence over host/port when set (unless `client` is provided)
   */
  url?: string;
  /**
   * Host / port / password style options (ignored when `url` or `client` is set)
   */
  connection?: RedisConnectionOptions;
  /**
   * Inject an existing ioredis client (command + duplicate for pub/sub)
   */
  client?: Redis;
  /**
   * Whether this is a global module
   * @default true
   */
  isGlobal?: boolean;
}

/**
 * Handler for Redis pub/sub messages
 */
export type RedisMessageHandler = (message: string, channel: string) => void | Promise<void>;
