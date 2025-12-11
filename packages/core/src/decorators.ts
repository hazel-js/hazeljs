import 'reflect-metadata';
import logger from './logger';
import { Type } from './types';
import { PipeTransform, PipeMetadata } from './pipes/pipe';
import { Interceptor, InterceptorMetadata } from './interceptors/interceptor';
import { HazelApp } from './hazel-app';

const CONTROLLER_METADATA_KEY = 'hazel:controller';
const INJECTABLE_METADATA_KEY = 'hazel:injectable';
const ROUTE_METADATA_KEY = 'hazel:routes';
const SERVICE_METADATA_KEY = 'hazel:service';
const INJECT_METADATA_KEY = 'hazel:inject';
const PIPE_METADATA_KEY = 'hazel:pipe';
const INTERCEPTOR_METADATA_KEY = 'hazel:interceptor';
const CLASS_INTERCEPTOR_METADATA_KEY = 'hazel:class-interceptors';

export interface ControllerMetadata {
  path: string;
  interceptors?: InterceptorMetadata[];
}

export interface RouteMetadata {
  path: string;
  method: string;
  handler: string | symbol;
  middlewares?: Type<unknown>[];
  pipes?: PipeMetadata[];
}

export interface ControllerOptions {
  path: string;
  version?: string;
}

export interface RouteOptions {
  path?: string;
  middlewares?: Type<unknown>[];
  pipes?: PipeMetadata[];
  interceptors?: InterceptorMetadata[];
}

export interface ModuleOptions {
  controllers?: Type[];
  providers?: Type[];
  exports?: Type[];
  imports?: Type[];
}

export interface ServiceOptions {
  scope?: 'singleton' | 'transient' | 'request';
}

export interface InjectableOptions {
  scope?: 'singleton' | 'transient' | 'request';
}

export interface RepositoryOptions {
  model: string;
}

export interface OnModuleInit {
  onModuleInit(): Promise<void>;
}

export interface OnModuleDestroy {
  onModuleDestroy(): Promise<void>;
}

export interface ExecutionContext {
  switchToHttp(): {
    getRequest(): unknown;
    getResponse(): unknown;
  };
}

export interface CanActivate {
  canActivate(context: ExecutionContext): Promise<boolean> | boolean;
}

// Re-export from hazel-module for backward compatibility
export { HazelModule, Module } from './hazel-module';

export function Controller(options: ControllerOptions | string): ClassDecorator {
  return (target) => {
    const opts = typeof options === 'string' ? { path: options } : options;
    logger.debug(
      `Registering controller: ${target.constructor?.name || target.name} at path: ${opts.path}`
    );
    Reflect.defineMetadata(CONTROLLER_METADATA_KEY, opts, target);
  };
}

export function Injectable(options: InjectableOptions = {}): ClassDecorator {
  return (target) => {
    logger.debug(`Registering injectable: ${target.constructor?.name || target.name}`);
    Reflect.defineMetadata(INJECTABLE_METADATA_KEY, options, target);
    // Store scope metadata for container
    if (options.scope) {
      Reflect.defineMetadata('hazel:scope', options.scope, target);
    }
  };
}

export function Get(options?: { path?: string } | string): MethodDecorator {
  const opts = typeof options === 'string' ? { path: options } : options || {};
  return createRouteDecorator('GET', opts);
}

export function Post(options?: { path?: string } | string): MethodDecorator {
  const opts = typeof options === 'string' ? { path: options } : options || {};
  return createRouteDecorator('POST', opts);
}

export function Put(options?: { path?: string } | string): MethodDecorator {
  const opts = typeof options === 'string' ? { path: options } : options || {};
  return createRouteDecorator('PUT', opts);
}

export function Delete(options?: { path?: string } | string): MethodDecorator {
  const opts = typeof options === 'string' ? { path: options } : options || {};
  return createRouteDecorator('DELETE', opts);
}

export function Patch(options?: { path?: string } | string): MethodDecorator {
  const opts = typeof options === 'string' ? { path: options } : options || {};
  return createRouteDecorator('PATCH', opts);
}

export function Inject(token?: string | symbol | Type<unknown>): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    logger.debug(
      `Registering injection for parameter ${parameterIndex} in ${target.constructor?.name}`
    );
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, target) || [];
    injections[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, target);
  };
}

export function Service(options: ServiceOptions = {}): ClassDecorator {
  return function (target: object): void {
    Reflect.defineMetadata(SERVICE_METADATA_KEY, options, target);

    // Store scope metadata for container
    if (options.scope) {
      Reflect.defineMetadata('hazel:scope', options.scope, target);
    }

    // Get constructor parameters
    const paramTypes = Reflect.getMetadata('design:paramtypes', target) || [];
    const repositories = paramTypes
      .map((paramType: new (...args: unknown[]) => unknown, index: number) => {
        const model = Reflect.getMetadata('hazel:repository', paramType)?.model;
        if (model) {
          return { index, model };
        }
        return null;
      })
      .filter(Boolean);

    if (repositories.length > 0) {
      Reflect.defineMetadata('hazel:repositories', repositories, target);
    }
  };
}

export function Body(dtoType?: Type<unknown>): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('Body decorator must be used on a method parameter');
    }

    logger.debug(`Registering body parameter ${parameterIndex} in ${target.constructor?.name}`);

    // Get the constructor of the target
    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) || [];

    // Store the injection metadata
    injections[parameterIndex] = {
      type: 'body',
      dtoType,
      token: dtoType,
    };

    logger.debug('Setting DTO type from Body decorator:', dtoType?.name);
    logger.debug('Updated injections:', JSON.stringify(injections, null, 2));

    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
  };
}

export function Request(): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('Request decorator must be used on a method parameter');
    }

    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) || [];
    injections[parameterIndex] = { type: 'request' };
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
  };
}

export function Param(paramName: string, pipe?: Type<PipeTransform>): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('Param decorator must be used on a method parameter');
    }

    logger.debug(
      `Registering param ${paramName} at index ${parameterIndex} in ${target.constructor?.name} with pipe:`,
      pipe?.name
    );

    // Get the constructor of the target
    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) || [];
    injections[parameterIndex] = { type: 'param', name: paramName, pipe };
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
    logger.debug('Updated injections:', JSON.stringify(injections, null, 2));
  };
}

export function Query(paramName?: string, pipe?: Type<PipeTransform>): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('Query decorator must be used on a method parameter');
    }

    logger.debug(
      `Registering query param ${paramName || 'all'} at index ${parameterIndex} in ${target.constructor?.name} with pipe:`,
      pipe?.name
    );

    // Get the constructor of the target
    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) || [];
    injections[parameterIndex] = { type: 'query', name: paramName, pipe };
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
    logger.debug('Updated injections:', JSON.stringify(injections, null, 2));
  };
}

export function UsePipes(
  ...pipes: (Type<PipeTransform> | PipeMetadata)[]
): ClassDecorator & MethodDecorator {
  const decorator = (target: object, propertyKey?: string | symbol): void => {
    const pipeMetadata = pipes.map((pipe) => {
      if (typeof pipe === 'function') {
        return { type: pipe };
      }
      return pipe;
    });

    if (propertyKey) {
      // Method decorator
      const routes = Reflect.getMetadata(ROUTE_METADATA_KEY, target.constructor) || [];
      const route = routes.find(
        (r: { propertyKey: string | symbol }) => r.propertyKey === propertyKey
      );
      if (route) {
        route.pipes = pipeMetadata;
        logger.debug('Setting pipes for route:', {
          method: route.method,
          path: route.path,
          pipes: pipeMetadata.map((p) => p.type.name),
        });
        Reflect.defineMetadata(ROUTE_METADATA_KEY, routes, target.constructor);
      }
    } else {
      // Class decorator
      const existingPipes = Reflect.getMetadata(PIPE_METADATA_KEY, target) || [];
      Reflect.defineMetadata(PIPE_METADATA_KEY, [...existingPipes, ...pipeMetadata], target);
    }
  };

  return decorator as ClassDecorator & MethodDecorator;
}

export function UseInterceptors(
  ...interceptors: (Type<Interceptor> | InterceptorMetadata)[]
): ClassDecorator & MethodDecorator {
  const decorator = (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ): PropertyDescriptor | void => {
    const interceptorMetadata = interceptors.map((interceptor) => {
      if (typeof interceptor === 'function') {
        return { type: interceptor };
      }
      return interceptor;
    });

    if (propertyKey && descriptor) {
      // Method decorator
      logger.debug(
        `Registering interceptors for method ${String(propertyKey)} in ${target.constructor?.name}`
      );
      Reflect.defineMetadata(INTERCEPTOR_METADATA_KEY, interceptorMetadata, target, propertyKey);
      return descriptor;
    } else {
      // Class decorator
      logger.debug(`Registering interceptors for class ${(target as { name?: string }).name}`);
      Reflect.defineMetadata(CLASS_INTERCEPTOR_METADATA_KEY, interceptorMetadata, target);
    }
  };

  return decorator as ClassDecorator & MethodDecorator;
}

export function UseGuards(...guards: Type<CanActivate>[]): ClassDecorator & MethodDecorator {
  const decorator = (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ): PropertyDescriptor | void => {
    if (propertyKey && descriptor) {
      // Method decorator
      const existingGuards = Reflect.getMetadata('hazel:guards', target, propertyKey) || [];
      Reflect.defineMetadata('hazel:guards', [...existingGuards, ...guards], target, propertyKey);
      return descriptor;
    } else {
      // Class decorator
      const existingGuards = Reflect.getMetadata('hazel:guards', target) || [];
      Reflect.defineMetadata('hazel:guards', [...existingGuards, ...guards], target);
    }
  };

  return decorator as ClassDecorator & MethodDecorator;
}

export function AITask(options: {
  name: string;
  prompt: string;
  provider: string;
  model: string;
  outputType: string;
}): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    Reflect.defineMetadata('hazel:ai-task', options, target, propertyKey);
    return descriptor;
  };
}

export function Res(): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('Res decorator must be used on a method parameter');
    }

    logger.debug(`Registering response parameter ${parameterIndex} in ${target.constructor?.name}`);

    // Get the constructor of the target
    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) || [];

    // Store the injection metadata
    injections[parameterIndex] = {
      type: 'response',
    };

    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
    logger.debug('Updated injections:', JSON.stringify(injections, null, 2));
  };
}

function createRouteDecorator(method: string, options?: RouteOptions | string): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void => {
    logger.debug(`Registering ${method} route: ${String(propertyKey)}`);
    const routes =
      Reflect.getMetadata(ROUTE_METADATA_KEY, (target as { constructor: object }).constructor) ||
      [];
    const routeOptions = typeof options === 'string' ? { path: options } : options || {};
    const pipes = Reflect.getMetadata(PIPE_METADATA_KEY, target, propertyKey) || [];
    const interceptors = Reflect.getMetadata(INTERCEPTOR_METADATA_KEY, target, propertyKey) || [];
    const classInterceptors =
      Reflect.getMetadata(
        CLASS_INTERCEPTOR_METADATA_KEY,
        (target as { constructor: object }).constructor
      ) || [];

    logger.debug('Route metadata:', {
      method,
      path: routeOptions.path || '/',
      propertyKey: String(propertyKey),
      pipes: pipes.map((p: { type: { name: string } }) => p.type.name),
      interceptors: interceptors.map((i: { type: { name: string } }) => i.type.name),
    });

    routes.push({
      method,
      path: routeOptions.path || '/',
      propertyKey,
      middlewares: routeOptions.middlewares || [],
      pipes: [...pipes, ...(routeOptions.pipes || [])],
      interceptors: [...classInterceptors, ...interceptors, ...(routeOptions.interceptors || [])],
    });
    Reflect.defineMetadata(
      ROUTE_METADATA_KEY,
      routes,
      (target as { constructor: object }).constructor
    );
    return descriptor;
  };
}

export { HazelApp };
