import { HazelModule } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { ContextService } from './context.service';
import type { ContextModuleOptions } from './types';
import { CONTEXT_OPTIONS } from './types';

@HazelModule({
  providers: [],
  exports: [],
})
export class ContextModule {
  static forRoot(options: ContextModuleOptions = {}): {
    module: typeof ContextModule;
    providers: Array<{
      provide: string | typeof ContextService;
      useValue?: unknown;
      useFactory?: (...args: unknown[]) => unknown;
      inject?: unknown[];
    }>;
    exports: Array<typeof ContextService | string>;
    global: boolean;
  } {
    logger.info('Configuring Context module...');
    const service = new ContextService(options);
    return {
      module: ContextModule,
      providers: [
        { provide: CONTEXT_OPTIONS, useValue: options },
        { provide: ContextService, useValue: service },
      ],
      exports: [ContextService],
      global: true,
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<ContextModuleOptions> | ContextModuleOptions;
    inject?: unknown[];
  }): {
    module: typeof ContextModule;
    providers: Array<{
      provide: string | typeof ContextService;
      useFactory: (...args: unknown[]) => unknown;
      inject?: unknown[];
    }>;
    exports: Array<typeof ContextService | string>;
    global: boolean;
  } {
    return {
      module: ContextModule,
      providers: [
        {
          provide: CONTEXT_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        {
          provide: ContextService,
          useFactory: (...args: unknown[]) => new ContextService(args[0] as ContextModuleOptions),
          inject: [CONTEXT_OPTIONS],
        },
      ],
      exports: [ContextService],
      global: true,
    };
  }
}
