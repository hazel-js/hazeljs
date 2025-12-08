import { HazelModule } from '@hazeljs/core';
import { CacheService, CacheManager } from './cache.service';
import { CacheStrategy } from './cache.types';
import logger from '@hazeljs/core';

/**
 * Cache module options
 */
export interface CacheModuleOptions {
  /**
   * Cache strategy to use
   * @default 'memory'
   */
  strategy?: CacheStrategy;

  /**
   * Whether this is a global module
   * @default true
   */
  isGlobal?: boolean;

  /**
   * Redis options (if using redis or multi-tier strategy)
   */
  redis?: {
    host?: string;
    port?: number;
    password?: string;
  };

  /**
   * Memory cache cleanup interval in milliseconds
   * @default 60000
   */
  cleanupInterval?: number;

  /**
   * Multiple cache configurations
   */
  stores?: Array<{
    name: string;
    strategy: CacheStrategy;
    isDefault?: boolean;
    options?: {
      redis?: {
        host?: string;
        port?: number;
        password?: string;
      };
      cleanupInterval?: number;
    };
  }>;
}

/**
 * Cache module for HazelJS
 */
@HazelModule({
  providers: [],
  exports: [],
})
export class CacheModule {
  /**
   * Configure cache module
   */
  static forRoot(options: CacheModuleOptions = {}): {
    module: typeof CacheModule;
    providers: Array<{
      provide: typeof CacheService | typeof CacheManager;
      useFactory?: () => CacheService;
      useValue?: CacheManager;
    }>;
    exports: Array<typeof CacheService | typeof CacheManager>;
    global: boolean;
  } {
    const { strategy = 'memory', isGlobal = true, redis, cleanupInterval, stores } = options;

    logger.info('Configuring cache module...');

    // Create cache manager
    const cacheManager = new CacheManager();

    // If multiple stores are configured
    if (stores && stores.length > 0) {
      for (const storeConfig of stores) {
        const cache = new CacheService(storeConfig.strategy, {
          redis: storeConfig.options?.redis || redis,
          cleanupInterval: storeConfig.options?.cleanupInterval || cleanupInterval,
        });
        cacheManager.register(storeConfig.name, cache, storeConfig.isDefault);
      }
    } else {
      // Single cache configuration
      const cache = new CacheService(strategy, { redis, cleanupInterval });
      cacheManager.register('default', cache, true);
    }

    return {
      module: CacheModule,
      providers: [
        {
          provide: CacheService,
          useFactory: () => cacheManager.get(),
        },
        {
          provide: CacheManager,
          useValue: cacheManager,
        },
      ],
      exports: [CacheService, CacheManager],
      global: isGlobal,
    };
  }

  /**
   * Configure cache module asynchronously
   */
  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<CacheModuleOptions> | CacheModuleOptions;
    inject?: unknown[];
  }): {
    module: typeof CacheModule;
    providers: Array<{
      provide: string | typeof CacheManager | typeof CacheService;
      useFactory: unknown;
      inject?: unknown[];
    }>;
    exports: Array<typeof CacheService | typeof CacheManager>;
    global: boolean;
  } {
    return {
      module: CacheModule,
      providers: [
        {
          provide: 'CACHE_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: CacheManager,
          useFactory: async (cacheOptions: CacheModuleOptions): Promise<CacheManager> => {
            const { strategy = 'memory', redis, cleanupInterval, stores } = cacheOptions;

            const cacheManager = new CacheManager();

            if (stores && stores.length > 0) {
              for (const storeConfig of stores) {
                const cache = new CacheService(storeConfig.strategy, {
                  redis: storeConfig.options?.redis || redis,
                  cleanupInterval: storeConfig.options?.cleanupInterval || cleanupInterval,
                });
                cacheManager.register(storeConfig.name, cache, storeConfig.isDefault);
              }
            } else {
              const cache = new CacheService(strategy, { redis, cleanupInterval });
              cacheManager.register('default', cache, true);
            }

            return cacheManager;
          },
          inject: ['CACHE_OPTIONS'],
        },
        {
          provide: CacheService,
          useFactory: (cacheManager: CacheManager) => cacheManager.get(),
          inject: [CacheManager],
        },
      ],
      exports: [CacheService, CacheManager],
      global: true,
    };
  }
}
