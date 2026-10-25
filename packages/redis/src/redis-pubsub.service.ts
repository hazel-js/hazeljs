import { Inject, Service } from '@hazeljs/core';
import logger from '@hazeljs/core';
import type Redis from 'ioredis';
import type { RedisMessageHandler } from './redis.types';
import { RedisService } from './redis.service';

/**
 * Redis pub/sub using a dedicated subscriber connection.
 * Publish uses the shared RedisService command client.
 */
@Service()
export class RedisPubSub {
  private subscriber: Redis | null = null;
  private handlers = new Map<string, Set<RedisMessageHandler>>();
  private messageListenerAttached = false;

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  /**
   * Wire an already-created subscriber client (used by RedisModule.forRoot)
   */
  setSubscriber(subscriber: Redis): void {
    this.subscriber = subscriber;
    this.attachMessageListener();
  }

  private ensureSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = this.redis.duplicate();
      this.attachMessageListener();
      logger.info('RedisPubSub subscriber connection created');
    }
    return this.subscriber;
  }

  private attachMessageListener(): void {
    if (!this.subscriber || this.messageListenerAttached) return;
    this.subscriber.on('message', (channel: string, message: string) => {
      const set = this.handlers.get(channel);
      if (!set) return;
      for (const handler of set) {
        try {
          void Promise.resolve(handler(message, channel)).catch((err) => {
            logger.error(`RedisPubSub handler error on ${channel}: ${String(err)}`);
          });
        } catch (err) {
          logger.error(`RedisPubSub handler error on ${channel}: ${String(err)}`);
        }
      }
    });
    this.messageListenerAttached = true;
  }

  /**
   * Publish a message. Objects are JSON-stringified.
   */
  async publish(channel: string, payload: string | object): Promise<number> {
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return this.redis.getClient().publish(channel, message);
  }

  /**
   * Subscribe to a channel. Multiple handlers per channel are supported.
   */
  async subscribe(channel: string, handler: RedisMessageHandler): Promise<void> {
    const sub = this.ensureSubscriber();
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
      await sub.subscribe(channel);
      logger.debug(`RedisPubSub subscribed to ${channel}`);
    }
    set.add(handler);
  }

  /**
   * Remove a handler, or all handlers for a channel when handler is omitted.
   * Unsubscribes from Redis when no handlers remain.
   */
  async unsubscribe(channel: string, handler?: RedisMessageHandler): Promise<void> {
    const set = this.handlers.get(channel);
    if (!set) return;

    if (handler) {
      set.delete(handler);
    } else {
      set.clear();
    }

    if (set.size === 0) {
      this.handlers.delete(channel);
      if (this.subscriber) {
        await this.subscriber.unsubscribe(channel);
        logger.debug(`RedisPubSub unsubscribed from ${channel}`);
      }
    }
  }

  /**
   * Close the dedicated subscriber connection
   */
  async disconnect(): Promise<void> {
    if (this.subscriber) {
      this.handlers.clear();
      await this.subscriber.quit();
      this.subscriber = null;
      this.messageListenerAttached = false;
      logger.info('RedisPubSub disconnected');
    }
  }
}
