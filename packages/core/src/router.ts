import { Type } from './types';
import { RequestContext, Request, Response } from './types';
import { Container } from './container';
import { MiddlewareHandler } from './middleware';
import { PipeTransform, ValidationError } from './pipes/pipe';
import { Interceptor } from './interceptors/interceptor';
import { HttpError } from './errors/http.error';
import 'reflect-metadata';
import logger from './logger';
import { RequestParser } from './request-parser';
import { HazelExpressResponse } from './hazel-response';
import { ValidationPipe } from './pipes/validation.pipe';

const ROUTE_METADATA_KEY = 'hazel:routes';
const CONTROLLER_METADATA_KEY = 'hazel:controller';

interface RouteMatch {
  handler: RouteHandler;
  context: RequestContext;
}

type RouteHandler = (req: Request, res: Response, context?: RequestContext) => void;

export class Router {
  private routes: Map<string, RouteHandler[]> = new Map();
  private middlewareHandler: MiddlewareHandler;

  constructor(private container: Container) {
    this.middlewareHandler = new MiddlewareHandler(container);
  }

  registerController(controller: Type<unknown>): void {
    logger.info(`Registering controller: ${controller.name}`);
    const controllerMetadata = Reflect.getMetadata(CONTROLLER_METADATA_KEY, controller) || {};
    const routes = Reflect.getMetadata(ROUTE_METADATA_KEY, controller) || [];
    logger.debug('Controller metadata:', controllerMetadata);
    logger.debug('Found routes:', routes);

    routes.forEach((route: { method: string; path: string; propertyKey: string | symbol }) => {
      const { method, path, propertyKey } = route;
      const basePath = controllerMetadata.path || '';
      const routePath = path || '';
      const fullPath = this.normalizePath(`${basePath}${routePath}`);
      logger.info(`Registering route: ${method} ${fullPath} (handler: ${String(propertyKey)})`);

      // Get parameter types from TypeScript metadata
      const paramTypes =
        Reflect.getMetadata('design:paramtypes', controller.prototype, propertyKey) || [];
      logger.debug(
        'Parameter types:',
        paramTypes.map((t: unknown) => (t as { name?: string })?.name || 'undefined')
      );

      // Get parameter injections
      const injections = Reflect.getMetadata('hazel:inject', controller, propertyKey) || [];
      logger.debug('Parameter injections:', injections);

      // Create a route handler for this specific route
      // Pass the controller class, not instance, so it can be resolved per-request
      const handler = this.createRouteHandler(controller, propertyKey);
      this.routes.set(`${method.toUpperCase()} ${fullPath}`, [handler]);

      // Log the route pattern for debugging
      const pattern = this.createRoutePattern(fullPath);
      logger.debug('Route pattern:', {
        path: fullPath,
        pattern: pattern.toString(),
        pipes:
          (route as { pipes?: { type: { name: string } }[] }).pipes?.map((p) => p.type.name) || [],
        paramTypes: paramTypes.map((t: unknown) => (t as { name?: string })?.name || 'undefined'),
      });
    });

    logger.debug('All registered routes:');
    this.routes.forEach((handlers, route) => {
      logger.debug(`${route}`);
    });
  }

  private async applyPipes(
    value: unknown,
    pipes: { type: Type<PipeTransform>; options?: unknown }[],
    context: RequestContext
  ): Promise<unknown> {
    let result = value;

    // Get route-specific pipes
    const allPipes = pipes.map((p) => this.container.resolve(p.type));

    for (const pipe of allPipes) {
      try {
        result = await pipe.transform(result, context);
      } catch (error) {
        logger.error('Validation error:', error);
        // Re-throw the error to be caught by the route handler
        throw error;
      }
    }
    return result;
  }

  private async applyInterceptors(
    interceptors: { type: Type<Interceptor>; options?: unknown }[],
    context: RequestContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    if (interceptors.length === 0) {
      return next();
    }

    const [current, ...remaining] = interceptors;
    const interceptor = this.container.resolve(current.type);

    return interceptor.intercept(context, () => this.applyInterceptors(remaining, context, next));
  }

  private createRouteHandler(
    controllerClass: Type<unknown>,
    methodName: string | symbol
  ): RouteHandler {
    return async (req: Request, res: Response, matchedContext?: RequestContext): Promise<void> => {
      try {
        logger.debug('=== Request Handler Start ===');
        logger.debug(`Method: ${req.method}, URL: ${req.url}`);
        logger.debug('Matched context:', matchedContext);

        // Safely log request body without circular references
        const safeBody = JSON.parse(JSON.stringify(req.body || {}));
        logger.debug(`Request body: ${JSON.stringify(safeBody, null, 2)}`);

        // Generate a unique request ID for request-scoped providers
        const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Resolve controller instance per-request with requestId
        const controller = this.container.resolve(controllerClass, requestId);
        const routes = Reflect.getMetadata(ROUTE_METADATA_KEY, controllerClass) || [];
        const route = routes.find(
          (r: { propertyKey: string | symbol }) => r.propertyKey === methodName
        );

        if (!route) {
          throw new Error(`Route not found for method ${String(methodName)}`);
        }

        // Get parameter injections
        const injections = Reflect.getMetadata('hazel:inject', controllerClass, methodName) || [];

        // Use the matched context if available, otherwise create a new one
        const context: RequestContext = matchedContext || {
          params: req.params || {},
          query: JSON.parse(JSON.stringify(req.query || {})),
          body: safeBody,
          headers: Object.fromEntries(
            Object.entries(req.headers || {})
              .filter(([key]) => !key.toLowerCase().includes('authorization'))
              .map(([key, value]) => [key, String(value)])
          ),
          method: req.method || 'GET',
          url: req.url || '/',
        };

        // Set DTO type from the first parameter that has a DTO type
        for (const injection of injections) {
          if (injection?.dtoType) {
            context.dtoType = injection.dtoType;
            break;
          }
        }

        // Get pipes for this route
        const routePipes = (route as { pipes?: { type: Type<PipeTransform> }[] }).pipes || [];

        // Prepare arguments for the controller method
        const args: unknown[] = [];
        for (let i = 0; i < injections.length; i++) {
          const injection = injections[i];
          if (typeof injection === 'string') {
            // Handle @Body, @Param, @Query decorators
            if (injection === 'body') {
              args[i] = context.body;
            } else if (injection === 'param') {
              args[i] = context.params;
            } else if (injection === 'query') {
              args[i] = context.query;
            } else if (injection === 'headers') {
              args[i] = context.headers;
            }
          } else if (typeof injection === 'object' && injection !== null) {
            if (injection.type === 'response') {
              // Handle @Res decorator
              args[i] = new HazelExpressResponse(res);
            } else if (injection.type === 'body') {
              // Handle @Body decorator with DTO type
              if (injection.dtoType) {
                context.dtoType = injection.dtoType;
                logger.debug('Setting DTO type in context:', injection.dtoType.name);
              }
              args[i] = context.body;
            } else if (injection.type === 'param') {
              // Handle @Param decorator with pipe
              const paramName = injection.name;
              const paramValue = matchedContext?.params[paramName] || context.params[paramName];
              if (injection.pipe) {
                const pipe = this.container.resolve(injection.pipe) as PipeTransform;
                args[i] = await pipe.transform(paramValue, context);
              } else {
                args[i] = paramValue;
              }
            }
          }
        }

        // Apply ValidationPipe to the body if a DTO type is present
        if (context.body && context.dtoType) {
          logger.debug('Applying ValidationPipe with DTO type:', context.dtoType.name);
          const validationPipe = this.container.resolve(ValidationPipe);
          context.body = await validationPipe.transform(context.body, context);
          args[
            injections.findIndex(
              (i: unknown) =>
                typeof i === 'object' && i !== null && (i as { type?: string }).type === 'body'
            )
          ] = context.body;
        }

        // Apply other pipes to the body if it exists
        if (context.body) {
          context.body = await this.applyPipes(context.body, routePipes, context);
        }

        // Get the controller method
        const method = (controller as Record<string | symbol, unknown>)[methodName] as (
          ...args: unknown[]
        ) => Promise<unknown>;

        // Execute the controller method with interceptors
        const result = await this.applyInterceptors(
          Reflect.getMetadata('hazel:interceptors', controllerClass, methodName) || [],
          context,
          async () => {
            return method.apply(controller, args);
          }
        );

        // Handle the response
        if (result !== undefined) {
          if (typeof result === 'string' && result.trim().startsWith('<!DOCTYPE html>')) {
            // Handle HTML response
            res.setHeader('Content-Type', 'text/html');
            res.send(result);
          } else {
            // Handle JSON response
            res.json(result);
          }
        }
      } catch (error) {
        logger.error('Request handler error:', error);
        if (error instanceof ValidationError) {
          const errorResponse = error.toJSON();
          logger.error('Validation error response:', errorResponse);
          res.status(400).json({
            statusCode: 400,
            message: errorResponse.message,
            errors: errorResponse.errors,
          });
        } else if (error instanceof HttpError) {
          res.status(error.statusCode).json({
            statusCode: error.statusCode,
            message: error.message,
          });
        } else {
          res.status(500).json({
            statusCode: 500,
            message: 'Internal server error',
          });
        }
      }
    };
  }

  private extractParams(path: string, routePath: string): Record<string, string> {
    const params: Record<string, string> = {};
    const pathParts = path.split('/');
    const routeParts = routePath.split('/');

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        const paramName = routeParts[i].slice(1);
        params[paramName] = pathParts[i];
        logger.debug(`Extracted param ${paramName}:`, pathParts[i]);
      }
    }

    logger.debug('Extracted params:', params);
    return params;
  }

  private matchPath(path: string, routePath: string): boolean {
    const pathParts = path.split('/');
    const routeParts = routePath.split('/');

    if (pathParts.length !== routeParts.length) {
      return false;
    }

    for (let i = 0; i < routeParts.length; i++) {
      if (!routeParts[i].startsWith(':') && routeParts[i] !== pathParts[i]) {
        return false;
      }
    }

    return true;
  }

  private createRoutePattern(path: string): RegExp {
    if (path === '/') {
      return /^\/?$/;
    }
    // Escape forward slashes and convert :param to ([^/]+)
    const pattern = path
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters
      .replace(/:[^/]+/g, '([^/]+)');
    return new RegExp(`^${pattern}/?$`);
  }

  private normalizePath(path: string): string {
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path.startsWith('/') ? path : `/${path}`;
  }

  async match(method: string, url: string, context: RequestContext): Promise<RouteMatch | null> {
    const path = url.split('?')[0];
    logger.debug(`Matching route: ${method} ${path}`);

    for (const [routeKey, handlers] of this.routes.entries()) {
      const [routeMethod, routePath] = routeKey.split(' ');
      if (routeMethod === method && this.matchPath(path, routePath)) {
        const params = this.extractParams(path, routePath);
        logger.debug('Matched route:', { method, url, params });

        // Create a new context with the matched parameters
        const matchedContext: RequestContext = {
          ...context,
          params: params, // Don't merge, just use the extracted params
        };
        logger.debug('Created matched context:', matchedContext);

        // Create a new handler that ensures the context is passed
        const handler = handlers[0];
        const wrappedHandler: RouteHandler = async (
          req: Request,
          res: Response,
          ctx?: RequestContext
        ) => {
          logger.debug('Wrapped handler called with context:', ctx);
          await handler(req, res, matchedContext);
        };

        return { handler: wrappedHandler, context: matchedContext };
      }
    }

    return null;
  }

  get(path: string, handlers: RouteHandler[]): void {
    this.addRoute('GET', path, handlers);
  }

  post(path: string, handlers: RouteHandler[]): void {
    this.addRoute('POST', path, handlers);
  }

  put(path: string, handlers: RouteHandler[]): void {
    this.addRoute('PUT', path, handlers);
  }

  delete(path: string, handlers: RouteHandler[]): void {
    this.addRoute('DELETE', path, handlers);
  }

  private addRoute(method: string, path: string, handlers: RouteHandler[]): void {
    const normalizedPath = this.normalizePath(path);
    this.routes.set(`${method.toUpperCase()} ${normalizedPath}`, handlers);
  }

  async handleRequest(req: Request, res: Response): Promise<void> {
    try {
      logger.debug('=== Request Handler Start ===');
      logger.debug(`Method: ${req.method}, URL: ${req.url}`);

      // Parse the request to get the initial context
      const context = await RequestParser.parseRequest(req);
      logger.debug('Initial context:', context);

      // Match the request method and URL
      const match = await this.match(req.method || 'GET', req.url || '/', context);
      if (!match) {
        logger.warn(`No route found for ${req.method} ${req.url}`);
        res.status(404).json({ error: 'Not Found' });
        return;
      }

      // Log the matched context before passing it
      logger.debug('Matched context before handler:', match.context);

      // Update request params with matched parameters
      req.params = match.context.params;
      logger.debug('Updated request params:', req.params);

      // Call the matched handler with the matched context
      const handler = match.handler;
      await handler(req, res, match.context);
    } catch (error) {
      logger.error('Error handling request:', error);
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
    }
  }
}
