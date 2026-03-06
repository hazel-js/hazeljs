import 'reflect-metadata';
import logger from './logger';
import { Type, RequestContext, Request } from './types';
import { PipeTransform, PipeMetadata } from './pipes/pipe';
import { Interceptor, InterceptorMetadata, RetryInterceptor } from './interceptors/interceptor';
import { HazelApp } from './hazel-app';
import type { Container } from './container';

const CONTROLLER_METADATA_KEY = 'hazel:controller';
const INJECTABLE_METADATA_KEY = 'hazel:injectable';
const ROUTE_METADATA_KEY = 'hazel:routes';
const SERVICE_METADATA_KEY = 'hazel:service';
const INJECT_METADATA_KEY = 'hazel:inject';
const PIPE_METADATA_KEY = 'hazel:pipe';
const INTERCEPTOR_METADATA_KEY = 'hazel:interceptor';
const CLASS_INTERCEPTOR_METADATA_KEY = 'hazel:class-interceptors';
const HTTP_CODE_METADATA_KEY = 'hazel:http-code';
const HEADER_METADATA_KEY = 'hazel:headers';
const REDIRECT_METADATA_KEY = 'hazel:redirect';
const PUBLIC_METADATA_KEY = 'hazel:public';
const TIMEOUT_METADATA_KEY = 'hazel:timeout';
const OPTIONAL_INDICES_METADATA_KEY = 'hazel:optional-indices';
const RETRY_METADATA_KEY = 'hazel:retry';
const API_TAGS_METADATA_KEY = 'hazel:api:tags';
const API_OPERATION_METADATA_KEY = 'hazel:api:operation';
export const CUSTOM_METADATA_PREFIX = 'hazel:meta:';

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

// ModuleOptions is defined in hazel-module.ts — import from there if needed

export interface ServiceOptions {
  scope?: 'singleton' | 'transient' | 'request';
}

export interface InjectableOptions {
  scope?: 'singleton' | 'transient' | 'request';
}

export interface RepositoryOptions {
  model: string;
  scope?: 'singleton' | 'transient' | 'request';
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
    /**
     * Returns the fully parsed RequestContext for this request.
     * Gives guards access to `params`, `query`, `headers`, `user`, and `body`
     * without having to re-parse the raw Node.js IncomingMessage.
     */
    getContext(): RequestContext;
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

export function Req(): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('Req decorator must be used on a method parameter');
    }

    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) || [];
    injections[parameterIndex] = { type: 'request' };
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
  };
}

export function Headers(headerName?: string): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('Headers decorator must be used on a method parameter');
    }

    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) || [];
    injections[parameterIndex] = { type: 'headers', name: headerName };
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
  };
}

export function HttpCode(statusCode: number): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    Reflect.defineMetadata(HTTP_CODE_METADATA_KEY, statusCode, target, propertyKey);
    return descriptor;
  };
}

export function Header(name: string, value: string): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    const existingHeaders: Array<{ name: string; value: string }> =
      Reflect.getMetadata(HEADER_METADATA_KEY, target, propertyKey) || [];
    existingHeaders.push({ name, value });
    Reflect.defineMetadata(HEADER_METADATA_KEY, existingHeaders, target, propertyKey);
    return descriptor;
  };
}

export function Redirect(url: string, statusCode: number = 302): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    Reflect.defineMetadata(REDIRECT_METADATA_KEY, { url, statusCode }, target, propertyKey);
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

export function Ip(): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('Ip decorator must be used on a method parameter');
    }
    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) || [];
    injections[parameterIndex] = { type: 'ip' };
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
  };
}

export function Host(): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('Host decorator must be used on a method parameter');
    }
    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) || [];
    injections[parameterIndex] = { type: 'host' };
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
  };
}

/**
 * Marks a controller or route as public (no auth required).
 * Guards should check Reflect.getMetadata(PUBLIC_METADATA_KEY, target, propertyKey)
 * or Reflect.getMetadata(PUBLIC_METADATA_KEY, target) and allow the request when true.
 */
export function Public(): ClassDecorator & MethodDecorator {
  const setPublic = (target: object, propertyKey?: string | symbol): void => {
    if (propertyKey === undefined) {
      Reflect.defineMetadata(PUBLIC_METADATA_KEY, true, target);
    } else {
      Reflect.defineMetadata(PUBLIC_METADATA_KEY, true, target, propertyKey);
    }
  };
  const decorator = (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ): PropertyDescriptor | void => {
    if (propertyKey !== undefined && descriptor !== undefined) {
      setPublic(target, propertyKey);
      return descriptor;
    }
    setPublic(target);
  };
  return decorator as ClassDecorator & MethodDecorator;
}

/** Alias for @Public(). Use when you want to skip auth for specific routes. */
export const SkipAuth = Public;

export function Timeout(ms: number): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    Reflect.defineMetadata(TIMEOUT_METADATA_KEY, ms, target, propertyKey);
    return descriptor;
  };
}

export function Optional(): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('Optional decorator must be used on a method parameter');
    }
    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const indices: number[] = Reflect.getMetadata(OPTIONAL_INDICES_METADATA_KEY, constructor, propertyKey) || [];
    if (!indices.includes(parameterIndex)) {
      indices.push(parameterIndex);
    }
    Reflect.defineMetadata(OPTIONAL_INDICES_METADATA_KEY, indices, constructor, propertyKey);
  };
}

export function Session(): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('Session decorator must be used on a method parameter');
    }
    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) || [];
    injections[parameterIndex] = { type: 'session' };
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
  };
}

export interface RetryDecoratorOptions {
  count: number;
  delay?: number;
  retryIf?: (err: Error) => boolean;
}

export function Retry(options: RetryDecoratorOptions): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    Reflect.defineMetadata(RETRY_METADATA_KEY, options, target, propertyKey);
    const routes = Reflect.getMetadata(ROUTE_METADATA_KEY, (target as { constructor: object }).constructor) || [];
    const route = routes.find((r: { propertyKey: string | symbol }) => r.propertyKey === propertyKey);
    if (route) {
      route.interceptors = route.interceptors || [];
      route.interceptors.unshift({ type: RetryInterceptor, options });
      Reflect.defineMetadata(ROUTE_METADATA_KEY, routes, (target as { constructor: object }).constructor);
    }
    return descriptor;
  };
}

export function ApiTags(...tags: string[]): ClassDecorator & MethodDecorator {
  const setTags = (target: object, propertyKey?: string | symbol): void => {
    if (propertyKey === undefined) {
      Reflect.defineMetadata(API_TAGS_METADATA_KEY, tags, target);
    } else {
      Reflect.defineMetadata(API_TAGS_METADATA_KEY, tags, target, propertyKey);
    }
  };
  const decorator = (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ): PropertyDescriptor | void => {
    if (propertyKey !== undefined && descriptor !== undefined) {
      setTags(target, propertyKey);
      return descriptor;
    }
    setTags(target);
  };
  return decorator as ClassDecorator & MethodDecorator;
}

export interface ApiOperationOptions {
  summary?: string;
  description?: string;
  operationId?: string;
}

export function ApiOperation(options: ApiOperationOptions | string): MethodDecorator {
  const opts = typeof options === 'string' ? { summary: options } : options;
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    Reflect.defineMetadata(API_OPERATION_METADATA_KEY, opts, target, propertyKey);
    return descriptor;
  };
}

/**
 * Sets arbitrary metadata on a class or method.
 * Guards, interceptors, and other components can read it via getMetadata(key, target, propertyKey?).
 *
 * @param key - Metadata key (stored under hazel:meta:<key> to avoid collisions)
 * @param value - Value to store (any serializable or object)
 * @example
 * SetMetadata('roles', ['admin'])(MyController)
 * SetMetadata('roles', ['user'])(MyController.prototype, 'getProfile')
 */
export function SetMetadata(key: string, value: unknown): ClassDecorator & MethodDecorator {
  const metaKey = `${CUSTOM_METADATA_PREFIX}${key}`;
  const decorator = (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ): void | PropertyDescriptor => {
    if (propertyKey !== undefined && descriptor !== undefined) {
      Reflect.defineMetadata(metaKey, value, target, propertyKey);
      return descriptor;
    }
    Reflect.defineMetadata(metaKey, value, target);
  };
  return decorator as ClassDecorator & MethodDecorator;
}

/**
 * Reads custom metadata set with SetMetadata.
 *
 * @param key - Key passed to SetMetadata(key, value)
 * @param target - Class or prototype
 * @param propertyKey - Optional method name (for method-level metadata)
 */
export function getMetadata<T = unknown>(
  key: string,
  target: object,
  propertyKey?: string | symbol
): T | undefined {
  const metaKey = `${CUSTOM_METADATA_PREFIX}${key}`;
  if (propertyKey !== undefined) {
    return Reflect.getMetadata(metaKey, target, propertyKey) as T | undefined;
  }
  return Reflect.getMetadata(metaKey, target) as T | undefined;
}

/**
 * Context passed to custom parameter decorator resolvers.
 * The router calls the resolver with (req, context, container) when invoking the handler.
 */
export interface ParamDecoratorContext {
  req: Request;
  context: RequestContext;
  container: Container;
}

/**
 * Creates a custom parameter decorator that injects a value computed from the request.
 * The resolver receives the raw request, parsed request context, and the DI container.
 * Return value can be a Promise for async resolution (e.g. loading the current user from DB).
 *
 * @param resolve - Function (req, context, container) => value | Promise<value>
 * @example
 * const CurrentUser = createParamDecorator(async (req, ctx, container) => ctx.user ?? req.user);
 * // In controller: getProfile(@CurrentUser() user: User) { ... }
 */
export function createParamDecorator<T = unknown>(
  resolve: (req: Request, context: RequestContext, container: Container) => T | Promise<T>
): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('createParamDecorator must be used on a method parameter');
    }
    const constructor = (target as { constructor: new (...args: unknown[]) => object }).constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) || [];
    injections[parameterIndex] = { type: 'custom', resolve };
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
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
