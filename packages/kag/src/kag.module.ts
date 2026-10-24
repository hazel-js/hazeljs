import { HazelModule } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { KagService } from './kag.service';
import type { KagModuleOptions } from './types';
import { KAG_OPTIONS } from './types';

@HazelModule({
  providers: [],
  exports: [],
})
export class KagModule {
  static forRoot(options: KagModuleOptions = {}): {
    module: typeof KagModule;
    providers: Array<{
      provide: string | typeof KagService;
      useValue?: unknown;
      useFactory?: (...args: unknown[]) => unknown;
      inject?: unknown[];
    }>;
    exports: Array<typeof KagService | string>;
    global: boolean;
  } {
    logger.info('Configuring KAG module...');
    const service = new KagService(options);
    return {
      module: KagModule,
      providers: [
        { provide: KAG_OPTIONS, useValue: options },
        { provide: KagService, useValue: service },
      ],
      exports: [KagService],
      global: true,
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<KagModuleOptions> | KagModuleOptions;
    inject?: unknown[];
  }): {
    module: typeof KagModule;
    providers: Array<{
      provide: string | typeof KagService;
      useFactory: (...args: unknown[]) => unknown;
      inject?: unknown[];
    }>;
    exports: Array<typeof KagService | string>;
    global: boolean;
  } {
    return {
      module: KagModule,
      providers: [
        {
          provide: KAG_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        {
          provide: KagService,
          useFactory: (...args: unknown[]) => new KagService(args[0] as KagModuleOptions),
          inject: [KAG_OPTIONS],
        },
      ],
      exports: [KagService],
      global: true,
    };
  }
}
