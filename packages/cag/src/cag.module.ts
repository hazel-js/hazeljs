import { HazelModule } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { CagService } from './cag.service';
import type { CagModuleOptions, CagStore, RedisLikeClient } from './types';
import { CAG_OPTIONS } from './types';
import { MemoryCagStore } from './stores/memory-cag.store';
import { RedisCagStore } from './stores/redis-cag.store';
import { CagError } from './errors/cag.error';

function createStore(options: CagModuleOptions): CagStore {
  if (options.store && typeof options.store === 'object') {
    return options.store;
  }
  if (options.store === 'redis') {
    const client = options.redis?.client;
    if (!client) {
      throw CagError.configurationError(
        'store: "redis" requires redis.client (ioredis-compatible). ' +
          'Pass an injected client or use store: "memory" for development.'
      );
    }
    return new RedisCagStore(client as RedisLikeClient);
  }
  return new MemoryCagStore();
}

@HazelModule({
  providers: [],
  exports: [],
})
export class CagModule {
  static forRoot(options: CagModuleOptions = {}): {
    module: typeof CagModule;
    providers: Array<{
      provide: string | typeof CagService;
      useValue?: unknown;
      useFactory?: (...args: unknown[]) => unknown;
      inject?: unknown[];
    }>;
    exports: Array<typeof CagService | string>;
    global: boolean;
  } {
    logger.info('Configuring CAG module...');
    const store = createStore(options);
    const service = new CagService(options, store);

    return {
      module: CagModule,
      providers: [
        { provide: CAG_OPTIONS, useValue: options },
        { provide: CagService, useValue: service },
      ],
      exports: [CagService],
      global: true,
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<CagModuleOptions> | CagModuleOptions;
    inject?: unknown[];
  }): {
    module: typeof CagModule;
    providers: Array<{
      provide: string | typeof CagService;
      useFactory: (...args: unknown[]) => unknown;
      inject?: unknown[];
    }>;
    exports: Array<typeof CagService | string>;
    global: boolean;
  } {
    return {
      module: CagModule,
      providers: [
        {
          provide: CAG_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        {
          provide: CagService,
          useFactory: (...args: unknown[]): CagService => {
            const opts = args[0] as CagModuleOptions;
            const store = createStore(opts);
            return new CagService(opts, store);
          },
          inject: [CAG_OPTIONS],
        },
      ],
      exports: [CagService],
      global: true,
    };
  }
}
