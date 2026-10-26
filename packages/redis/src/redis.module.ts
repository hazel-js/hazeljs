import { HazelModule, Container } from '@hazeljs/core';
import logger from '@hazeljs/core';
import type Redis from 'ioredis';
import { RedisService } from './redis.service';
import { RedisPubSub } from './redis-pubsub.service';
import { getOnChannelMetadata } from './on-channel.decorator';
import type { RedisModuleOptions } from './redis.types';

/**
 * Redis module for HazelJS — shared client + pub/sub
 */
@HazelModule({
  providers: [RedisService, RedisPubSub],
  exports: [RedisService, RedisPubSub],
})
export class RedisModule {
  /**
   * Configure Redis with URL, connection options, or an existing client
   */
  static forRoot(options: RedisModuleOptions = {}): {
    module: typeof RedisModule;
    providers: Array<
      | { provide: typeof RedisService; useFactory: () => RedisService }
      | {
          provide: typeof RedisPubSub;
          useFactory: (redis: RedisService) => RedisPubSub;
          inject: Array<typeof RedisService>;
        }
    >;
    exports: Array<typeof RedisService | typeof RedisPubSub>;
    global: boolean;
  } {
    const { url, connection, client, isGlobal = true } = options;

    logger.info('Configuring Redis module...');

    const redisServiceProvider = {
      provide: RedisService,
      useFactory: (): RedisService => {
        const service = new RedisService();
        if (client) {
          service.setClient(client, false);
        } else {
          service.connectFromOptions({ url, connection });
        }
        return service;
      },
    };

    const pubSubProvider = {
      provide: RedisPubSub,
      inject: [RedisService],
      useFactory: (redis: RedisService): RedisPubSub => {
        const pubsub = new RedisPubSub(redis);
        // Eager subscriber so publish/subscribe is ready without first subscribe call racing
        const subscriber: Redis = redis.duplicate();
        pubsub.setSubscriber(subscriber);
        return pubsub;
      },
    };

    return {
      module: RedisModule,
      providers: [redisServiceProvider, pubSubProvider],
      exports: [RedisService, RedisPubSub],
      global: isGlobal,
    };
  }

  /**
   * Resolve RedisService from the container
   */
  static getRedisService(): RedisService {
    const container = Container.getInstance();
    const service = container.resolve(RedisService);
    if (!service) {
      throw new Error('RedisService not found. Ensure RedisModule.forRoot() is imported.');
    }
    return service;
  }

  /**
   * Resolve RedisPubSub from the container
   */
  static getRedisPubSub(): RedisPubSub {
    const container = Container.getInstance();
    const service = container.resolve(RedisPubSub);
    if (!service) {
      throw new Error('RedisPubSub not found. Ensure RedisModule.forRoot() is imported.');
    }
    return service;
  }

  /**
   * Wire `@OnChannel` handlers on a provider instance to RedisPubSub
   */
  static async registerSubscribersFromProvider(provider: object): Promise<void> {
    const container = Container.getInstance();
    const pubsub = container.resolve(RedisPubSub);
    if (!pubsub) {
      logger.warn('RedisPubSub not found in DI container');
      return;
    }

    const metadataList = getOnChannelMetadata(provider);
    for (const meta of metadataList) {
      const instance = provider as Record<string, (...args: unknown[]) => unknown>;
      const callback = instance[meta.methodName];
      if (typeof callback !== 'function') {
        logger.warn(
          `@OnChannel: method "${meta.methodName}" not found on ${provider.constructor?.name}`
        );
        continue;
      }

      const bound = callback.bind(provider);
      const parseJson = meta.options.parseJson !== false;

      await pubsub.subscribe(meta.channel, (raw, channel) => {
        try {
          if (parseJson) {
            const payload = JSON.parse(raw) as unknown;
            void Promise.resolve(bound(payload, channel)).catch((err) => {
              logger.error(`@OnChannel handler error on ${channel}: ${String(err)}`);
            });
          } else {
            void Promise.resolve(bound(raw, channel)).catch((err) => {
              logger.error(`@OnChannel handler error on ${channel}: ${String(err)}`);
            });
          }
        } catch (err) {
          logger.error(`@OnChannel parse/handler error on ${channel}: ${String(err)}`);
        }
      });

      logger.debug(
        `Registered Redis subscriber: ${meta.channel} → ${provider.constructor?.name}.${meta.methodName}`
      );
    }
  }

  /**
   * Resolve provider classes from the container and register their `@OnChannel` handlers
   */
  static async registerSubscribersFromProviders(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DI tokens have varied constructors
    providerClasses: Array<new (...args: any[]) => object>
  ): Promise<void> {
    const container = Container.getInstance();
    for (const Cls of providerClasses) {
      const instance = container.resolve(Cls);
      if (instance) {
        await this.registerSubscribersFromProvider(instance);
      } else {
        logger.warn(`Provider ${Cls.name} not found in DI container`);
      }
    }
  }
}
