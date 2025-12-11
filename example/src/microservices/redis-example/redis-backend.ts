/**
 * Shared Redis Backend Configuration
 * This creates a singleton Redis backend that can be used across all services
 */

import Redis from 'ioredis';
import { RedisRegistryBackend } from '@hazeljs/discovery';

// Redis configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_DB = parseInt(process.env.REDIS_DB || '0');

// Create Redis client
export const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Reconnect on READONLY error
      return true;
    }
    return false;
  },
});

// Handle Redis connection events
redis.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

redis.on('close', () => {
  console.log('⚠️  Redis connection closed');
});

// Create Redis backend
export const redisBackend = new RedisRegistryBackend(redis, {
  keyPrefix: 'hazeljs:discovery:',
  ttl: 90, // 90 seconds TTL
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Closing Redis connection...');
  await redis.quit();
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Closing Redis connection...');
  await redis.quit();
});
