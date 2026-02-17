import 'reflect-metadata';
import { Type } from './types';
import { Container, Scope } from './container';
import logger from './logger';

const MODULE_METADATA_KEY = 'hazel:module';
const ROUTE_METADATA_KEY = 'hazel:route';

export interface ModuleOptions {
  imports?: Type<unknown>[];
  controllers?: Type<unknown>[];
  providers?: Type<unknown>[];
  exports?: Type<unknown>[];
}

export function HazelModule(options: ModuleOptions): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(MODULE_METADATA_KEY, options, target);
  };
}

// Alias for backward compatibility
export const Module = HazelModule;

export function getModuleMetadata(target: object): ModuleOptions | undefined {
  const fromDecorator = Reflect.getMetadata(MODULE_METADATA_KEY, target);
  if (fromDecorator) return fromDecorator;
  // Support dynamic modules: { module, providers?, controllers?, imports? }
  if (target && typeof target === 'object' && 'module' in target) {
    const dyn = target as { module: Type<unknown>; providers?: unknown[]; controllers?: unknown[]; imports?: unknown[] };
    return {
      providers: dyn.providers as Type<unknown>[] | undefined,
      controllers: dyn.controllers as Type<unknown>[] | undefined,
      imports: dyn.imports as Type<unknown>[] | undefined,
    };
  }
  return undefined;
}

export class HazelModuleInstance {
  private container: Container;

  constructor(private readonly moduleType: Type<unknown>) {
    const name = (moduleType as { name?: string })?.name ?? (moduleType as { module?: { name?: string } })?.module?.name ?? 'DynamicModule';
    logger.debug(`Initializing HazelModule: ${name}`);
    this.container = Container.getInstance();
    this.initialize();
  }

  private initialize(): void {
    const metadata = getModuleMetadata(this.moduleType) || {};
    logger.debug('Module metadata:', metadata);

    // Initialize imported modules first (so their providers are available)
    if (metadata.imports) {
      logger.debug(
        'Initializing imported modules:',
        metadata.imports.map((m: unknown) => (m && typeof m === 'object' && 'module' in m ? (m as { module: { name?: string } }).module?.name : (m as { name?: string })?.name))
      );
      metadata.imports.forEach((moduleType: unknown) => {
        new HazelModuleInstance(moduleType as Type<unknown>);
      });
    }

    // Register providers
    if (metadata.providers) {
      logger.debug(
        'Registering providers:',
        metadata.providers.map((p: unknown) => (p && typeof p === 'object' && 'provide' in p ? (p as { provide: unknown }).provide : (p as { name?: string })?.name))
      );
      metadata.providers.forEach((provider: unknown) => {
        // Dynamic module provider: { provide, useFactory?, useClass?, useValue? } (NestJS-style)
        if (provider && typeof provider === 'object' && ('provide' in provider || 'token' in provider)) {
          const p = provider as { provide?: unknown; token?: unknown; useFactory?: unknown; useClass?: unknown; useValue?: unknown; inject?: unknown[] };
          const token = p.token ?? p.provide;
          logger.debug(`Registering provider config for: ${token}`);
          this.container.registerProvider({
            token,
            useFactory: p.useFactory,
            useClass: p.useClass,
            useValue: p.useValue,
            inject: p.inject,
          } as Parameters<Container['registerProvider']>[0]);
          return;
        }
        const cls = provider as Type<unknown>;
        logger.debug(`Registering provider: ${cls?.name}`);

        // Check if provider is request-scoped
        const scope = Reflect.getMetadata('hazel:scope', cls);

        if (scope === 'request') {
          // Don't eagerly resolve request-scoped providers
          this.container.registerProvider({
            token: cls,
            useClass: cls,
            scope: Scope.REQUEST,
          });
        } else {
          // Eagerly resolve singleton and transient providers
          this.container.register(cls, this.container.resolve(cls));
        }
      });
    }

    // Register controllers
    if (metadata.controllers) {
      logger.debug(
        'Registering controllers:',
        metadata.controllers.map((c: unknown) => (c as { name?: string })?.name)
      );
      metadata.controllers.forEach((controller) => {
        logger.debug(`Registering controller: ${controller.name}`);

        // Check if controller has request-scoped dependencies
        const paramTypes = Reflect.getMetadata('design:paramtypes', controller) || [];
        const hasRequestScopedDeps = paramTypes.some((paramType: unknown) => {
          if (!paramType) return false;
          const scope = Reflect.getMetadata('hazel:scope', paramType);
          return scope === 'request';
        });

        if (hasRequestScopedDeps) {
          // Don't eagerly resolve controllers with request-scoped dependencies
          logger.debug(
            `Skipping eager resolution for controller with request-scoped deps: ${controller.name}`
          );
          // Register as a class provider so it gets resolved per-request
          this.container.registerProvider({
            token: controller,
            useClass: controller,
            scope: Scope.SINGLETON, // Controller itself is singleton, but deps are request-scoped
          });
        } else {
          // Eagerly resolve controllers without request-scoped dependencies
          const instance = this.container.resolve(controller);
          this.container.register(controller, instance);
        }

        // Register controller routes
        const prototype = controller.prototype;
        const methodNames = Object.getOwnPropertyNames(prototype).filter(
          (name) => name !== 'constructor' && typeof prototype[name] === 'function'
        );

        methodNames.forEach((methodName) => {
          const route = Reflect.getMetadata(ROUTE_METADATA_KEY, prototype, methodName);
          if (route) {
            logger.debug(`Registering route: ${route.method} ${route.path}`);
          }
        });
      });
    }
  }

  getContainer(): Container {
    return this.container;
  }
}
