import {
  Container,
  HazelModule,
  type DynamicModule,
  type OnModuleDestroy,
  type OnModuleInit,
  getRegisteredAutonomousServices,
  Injectable,
  Inject,
} from '@hazeljs/core';
import logger from '@hazeljs/core';
import { AutonomousRuntime } from './runtime/autonomous.runtime';
import type { AutonomousModuleOptions } from './types';
import { MemoryAutonomousRunStore } from './store/memory-run.store';

export const AUTONOMOUS_OPTIONS = 'HAZEL_AUTONOMOUS_OPTIONS';
export const AUTONOMOUS_RUNTIME = AutonomousRuntime;

let cachedOptions: AutonomousModuleOptions = {};

@Injectable()
export class AutonomousBootstrapService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(AUTONOMOUS_OPTIONS) private readonly options: AutonomousModuleOptions,
    private readonly runtime: AutonomousRuntime
  ) {}

  async onModuleInit(): Promise<void> {
    const container = Container.getInstance();
    const classes = new Set<new (...args: unknown[]) => unknown>([
      ...(this.options.services ?? []),
    ]);
    if (this.options.autoDiscover !== false) {
      for (const c of getRegisteredAutonomousServices()) classes.add(c);
    }

    for (const Cls of classes) {
      try {
        const instance = container.resolve(Cls) as object;
        if (instance) this.runtime.bindInstance(Cls, instance);
      } catch {
        // Provider may not be in container yet — runtime may construct for tests.
      }
    }

    await this.runtime.start();
    await this.runtime.recover();
    logger.info(
      `AutonomousModule ready (${this.runtime.registry.listServices().length} service(s))`
    );
  }

  async onModuleDestroy(): Promise<void> {
    logger.info('AutonomousModule shutting down');
  }
}

@HazelModule({
  providers: [AutonomousRuntime, AutonomousBootstrapService],
  exports: [AutonomousRuntime],
})
export class AutonomousModule {
  static getOptions(): AutonomousModuleOptions {
    return cachedOptions;
  }

  static forRoot(options: AutonomousModuleOptions = {}): DynamicModule {
    cachedOptions = options;
    logger.info('Configuring AutonomousModule...');

    return {
      module: AutonomousModule,
      providers: [
        { provide: AUTONOMOUS_OPTIONS, useValue: options },
        {
          provide: AutonomousRuntime,
          useFactory: () =>
            new AutonomousRuntime({
              storage: options.storage ?? new MemoryAutonomousRunStore(),
              ...options,
            }),
        },
        AutonomousBootstrapService,
      ],
      exports: [AutonomousRuntime],
      global: true,
    };
  }
}
