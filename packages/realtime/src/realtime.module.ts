/**
 * RealtimeModule - Real-time voice AI for HazelJS
 */

import { HazelModule } from '@hazeljs/core';
import { RealtimeService } from './realtime.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeBootstrapService } from './realtime-bootstrap.service';
import type { RealtimeModuleOptions } from './realtime.types';

@HazelModule({
  providers: [],
  exports: [],
})
export class RealtimeModule {
  /**
   * Configure Realtime module with OpenAI Realtime API
   */
  static forRoot(options: RealtimeModuleOptions = {}): {
    module: typeof RealtimeModule;
    providers: Array<{
      provide: typeof RealtimeService | typeof RealtimeGateway | typeof RealtimeBootstrapService;
      useClass?: typeof RealtimeBootstrapService;
      useValue?: RealtimeService | RealtimeGateway;
    }>;
    exports: (typeof RealtimeService | typeof RealtimeGateway)[];
    global: boolean;
  } {
    const realtimeService = new RealtimeService({
      defaultProvider: options.defaultProvider ?? 'openai',
      openaiApiKey: options.openaiApiKey ?? process.env.OPENAI_API_KEY,
      defaultSessionConfig: options.defaultSessionConfig,
    });

    const realtimeGateway = new RealtimeGateway(realtimeService, {
      path: options.path ?? '/realtime',
    });

    return {
      module: RealtimeModule,
      providers: [
        { provide: RealtimeService, useValue: realtimeService },
        { provide: RealtimeGateway, useValue: realtimeGateway },
        {
          provide: RealtimeBootstrapService,
          useClass: RealtimeBootstrapService,
        },
      ],
      exports: [RealtimeService, RealtimeGateway],
      global: true,
    };
  }

  /**
   * Configure Realtime module asynchronously (e.g. from config service)
   */
  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<RealtimeModuleOptions> | RealtimeModuleOptions;
    inject?: unknown[];
  }): {
    module: typeof RealtimeModule;
    providers: Array<{
      provide:
        | string
        | typeof RealtimeService
        | typeof RealtimeGateway
        | typeof RealtimeBootstrapService;
      useFactory?: unknown;
      useClass?: typeof RealtimeBootstrapService;
      inject?: unknown[];
    }>;
    exports: (typeof RealtimeService | typeof RealtimeGateway)[];
    global: boolean;
  } {
    return {
      module: RealtimeModule,
      providers: [
        {
          provide: 'REALTIME_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        {
          provide: RealtimeService,
          useFactory: (opts: RealtimeModuleOptions) =>
            new RealtimeService({
              defaultProvider: opts.defaultProvider ?? 'openai',
              openaiApiKey: opts.openaiApiKey ?? process.env.OPENAI_API_KEY,
              defaultSessionConfig: opts.defaultSessionConfig,
            }),
          inject: ['REALTIME_OPTIONS'],
        },
        {
          provide: RealtimeGateway,
          useFactory: (service: RealtimeService, opts: RealtimeModuleOptions) =>
            new RealtimeGateway(service, { path: opts.path ?? '/realtime' }),
          inject: [RealtimeService, 'REALTIME_OPTIONS'],
        },
        {
          provide: RealtimeBootstrapService,
          useClass: RealtimeBootstrapService,
        },
      ],
      exports: [RealtimeService, RealtimeGateway],
      global: true,
    };
  }
}
