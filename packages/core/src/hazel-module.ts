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
  return Reflect.getMetadata(MODULE_METADATA_KEY, target);
}

export class HazelModuleInstance {
  private container: Container;

  constructor(private readonly moduleType: Type<unknown>) {
    logger.debug(`Initializing HazelModule: ${moduleType.name}`);
    this.container = Container.getInstance();
    this.initialize();
  }

  private initialize(): void {
    const metadata = getModuleMetadata(this.moduleType) || {};
    logger.debug('Module metadata:', metadata);

    // Register providers
    if (metadata.providers) {
      logger.debug(
        'Registering providers:',
        metadata.providers.map((p) => p.name)
      );
      metadata.providers.forEach((provider) => {
        logger.debug(`Registering provider: ${provider.name}`);

        // Check if provider is request-scoped
        const scope = Reflect.getMetadata('hazel:scope', provider);

        if (scope === 'request') {
          // Don't eagerly resolve request-scoped providers
          // They will be resolved per-request by the container
          logger.debug(`Skipping eager resolution for request-scoped provider: ${provider.name}`);
          // Just register the class itself, not an instance
          this.container.registerProvider({
            token: provider,
            useClass: provider,
            scope: Scope.REQUEST,
          });
        } else {
          // Eagerly resolve singleton and transient providers
          this.container.register(provider, this.container.resolve(provider));
        }
      });
    }

    // Register controllers
    if (metadata.controllers) {
      logger.debug(
        'Registering controllers:',
        metadata.controllers.map((c) => c.name)
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

    // Initialize imported modules
    if (metadata.imports) {
      logger.debug(
        'Initializing imported modules:',
        metadata.imports.map((m) => m.name)
      );
      metadata.imports.forEach((moduleType) => {
        new HazelModuleInstance(moduleType);
      });
    }
  }

  getContainer(): Container {
    return this.container;
  }
}
