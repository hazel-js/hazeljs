import { HazelModule } from '@hazeljs/core';
import { Container } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { EventEmitterService } from './event-emitter.service';
import { getOnEventMetadata } from './on-event.decorator';
import type { EventEmitterModuleOptions } from './event-emitter.types';

/**
 * Event emitter module options
 */
export interface EventEmitterModuleConfig extends EventEmitterModuleOptions {
  /**
   * Whether this is a global module
   * @default true
   */
  isGlobal?: boolean;
}

/**
 * Event emitter module for HazelJS
 * Provides event-driven architecture with decorators, similar to @nestjs/event-emitter
 *
 * @example
 * ```typescript
 * // app.module.ts
 * @HazelModule({
 *   imports: [
 *     EventEmitterModule.forRoot({ wildcard: true })
 *   ],
 *   controllers: [AppController],
 *   providers: [OrderService, OrderEventHandler]
 * })
 * export class AppModule {}
 * ```
 */
@HazelModule({
  providers: [EventEmitterService],
  exports: [EventEmitterService],
})
export class EventEmitterModule {
  /**
   * Configure event emitter module with options (passed to eventemitter2)
   */
  static forRoot(options: EventEmitterModuleConfig = {}): {
    module: typeof EventEmitterModule;
    providers: Array<{
      provide: typeof EventEmitterService;
      useFactory: () => EventEmitterService;
    }>;
    exports: Array<typeof EventEmitterService>;
    global: boolean;
  } {
    const { isGlobal = true, ...eeOptions } = options;

    logger.info('Configuring event emitter module...');

    const eventEmitterProvider = {
      provide: EventEmitterService,
      useFactory: (): EventEmitterService => new EventEmitterService(eeOptions),
    };

    return {
      module: EventEmitterModule,
      providers: [eventEmitterProvider],
      exports: [EventEmitterService],
      global: isGlobal,
    };
  }

  /**
   * Register event listeners from providers that have @OnEvent decorators
   * Call this after providers are instantiated (e.g. from a module's providers)
   *
   * @example
   * ```typescript
   * const orderHandler = container.resolve(OrderEventHandler);
   * EventEmitterModule.registerListenersFromProvider(orderHandler);
   * ```
   */
  static registerListenersFromProvider(provider: object): void {
    try {
      const container = Container.getInstance();
      const eventEmitter = container.resolve(EventEmitterService);

      if (!eventEmitter) {
        logger.warn('EventEmitterService not found in DI container');
        return;
      }

      const metadataList = getOnEventMetadata(provider);

      for (const meta of metadataList) {
        const instance = provider as Record<string, (...args: unknown[]) => unknown>;
        const callback = instance[meta.methodName];

        if (typeof callback !== 'function') {
          logger.warn(
            `@OnEvent: method "${meta.methodName}" not found on ${provider.constructor?.name}`
          );
          continue;
        }

        const boundCallback = callback.bind(provider);
        const opts = meta.options ?? {};

        if (opts.async) {
          eventEmitter.on(
            meta.event,
            async (...args: unknown[]) => {
              try {
                await boundCallback(...args);
              } catch (err) {
                if (!opts.suppressErrors) throw err;
                logger.error('Event listener error:', err);
              }
            },
            opts
          );
        } else {
          eventEmitter.on(
            meta.event,
            (...args: unknown[]) => {
              try {
                return boundCallback(...args);
              } catch (err) {
                if (!opts.suppressErrors) throw err;
                logger.error('Event listener error:', err);
              }
            },
            opts
          );
        }

        logger.debug(
          `Registered event listener: ${String(meta.event)} on ${provider.constructor?.name}`
        );
      }
    } catch (error) {
      logger.error('Error registering event listeners from provider:', error);
    }
  }

  /**
   * Register event listeners from multiple provider classes
   * Resolves each from the container and registers their @OnEvent handlers
   *
   * @example
   * ```typescript
   * EventEmitterModule.registerListenersFromProviders([
   *   OrderEventHandler,
   *   UserEventHandler,
   * ]);
   * ```
   */
  static registerListenersFromProviders(
    providerClasses: (new (...args: unknown[]) => object)[]
  ): void {
    const container = Container.getInstance();
    for (const Cls of providerClasses) {
      const instance = container.resolve(Cls);
      if (instance) {
        this.registerListenersFromProvider(instance);
      } else {
        logger.warn(`Provider ${Cls.name} not found in DI container`);
      }
    }
  }
}
