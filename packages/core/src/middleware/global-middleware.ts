import { Request, Response } from '../types';
import logger from '../logger';

/**
 * Next function type for middleware chain
 */
export type NextFunction = () => Promise<void> | void;

/**
 * Middleware function type
 */
export type MiddlewareFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

/**
 * Middleware interface
 */
export interface MiddlewareConsumer {
  apply(...middleware: Array<MiddlewareFunction | MiddlewareClass>): MiddlewareConfigProxy;
}

/**
 * Middleware class interface
 */
export interface MiddlewareClass {
  use(req: Request, res: Response, next: NextFunction): Promise<void> | void;
}

/**
 * Middleware configuration proxy
 */
export interface MiddlewareConfigProxy {
  forRoutes(...routes: Array<string | RouteInfo>): MiddlewareConfigProxy;
  exclude(...routes: Array<string | RouteInfo>): MiddlewareConfigProxy;
}

/**
 * Route information
 */
export interface RouteInfo {
  path: string;
  method?: string;
}

/**
 * Global middleware manager
 */
export class GlobalMiddlewareManager {
  private middleware: MiddlewareEntry[] = [];

  /**
   * Add global middleware
   */
  use(middleware: MiddlewareFunction | MiddlewareClass): void {
    logger.info('Registering global middleware');
    this.middleware.push({
      handler: middleware,
      routes: [],
      excludedRoutes: [],
    });
  }

  /**
   * Add middleware for specific routes
   */
  useFor(
    middleware: MiddlewareFunction | MiddlewareClass,
    routes: Array<string | RouteInfo>
  ): void {
    logger.info('Registering route-specific middleware');
    this.middleware.push({
      handler: middleware,
      routes: this.normalizeRoutes(routes),
      excludedRoutes: [],
    });
  }

  /**
   * Add middleware with exclusions
   */
  useExcept(
    middleware: MiddlewareFunction | MiddlewareClass,
    excludedRoutes: Array<string | RouteInfo>
  ): void {
    logger.info('Registering middleware with exclusions');
    this.middleware.push({
      handler: middleware,
      routes: [],
      excludedRoutes: this.normalizeRoutes(excludedRoutes),
    });
  }

  /**
   * Execute middleware chain for a request
   */
  async execute(req: Request, res: Response): Promise<void> {
    const applicableMiddleware = this.getApplicableMiddleware(req);

    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= applicableMiddleware.length) {
        return;
      }

      const entry = applicableMiddleware[index++];
      const handler = entry.handler;

      try {
        if (typeof handler === 'function') {
          await handler(req, res, next);
        } else {
          await handler.use(req, res, next);
        }
      } catch (error) {
        logger.error('Middleware error:', error);
        throw error;
      }
    };

    await next();
  }

  /**
   * Get middleware applicable to a request
   */
  private getApplicableMiddleware(req: Request): MiddlewareEntry[] {
    return this.middleware.filter((entry) => {
      // Check if route is excluded
      if (this.matchesAnyRoute(req, entry.excludedRoutes)) {
        return false;
      }

      // If no specific routes, apply to all
      if (entry.routes.length === 0) {
        return true;
      }

      // Check if route matches
      return this.matchesAnyRoute(req, entry.routes);
    });
  }

  /**
   * Check if request matches any route
   */
  private matchesAnyRoute(req: Request, routes: RouteInfo[]): boolean {
    const requestPath = req.url?.split('?')[0] || '/';
    const requestMethod = req.method || 'GET';

    return routes.some((route) => {
      const methodMatches = !route.method || route.method === requestMethod;
      const pathMatches = this.matchPath(requestPath, route.path);
      return methodMatches && pathMatches;
    });
  }

  /**
   * Match path with pattern
   */
  private matchPath(path: string, pattern: string): boolean {
    // Simple wildcard matching
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return path.startsWith(prefix);
    }
    return path === pattern;
  }

  /**
   * Normalize routes to RouteInfo array
   */
  private normalizeRoutes(routes: Array<string | RouteInfo>): RouteInfo[] {
    return routes.map((route) => {
      if (typeof route === 'string') {
        return { path: route };
      }
      return route;
    });
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.middleware = [];
  }

  /**
   * Get all registered middleware
   */
  getMiddleware(): MiddlewareEntry[] {
    return [...this.middleware];
  }
}

/**
 * Middleware entry
 */
interface MiddlewareEntry {
  handler: MiddlewareFunction | MiddlewareClass;
  routes: RouteInfo[];
  excludedRoutes: RouteInfo[];
}

/**
 * Built-in CORS middleware
 */
export class CorsMiddleware implements MiddlewareClass {
  constructor(private options: CorsOptions = {}) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const origin = this.options.origin || '*';
    const methods = this.options.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
    const headers = this.options.allowedHeaders || ['Content-Type', 'Authorization'];

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', headers.join(', '));

    if (this.options.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  }
}

export interface CorsOptions {
  origin?: string;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
}

/**
 * Built-in logging middleware
 */
export class LoggerMiddleware implements MiddlewareClass {
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const start = Date.now();

    logger.info(`→ ${req.method} ${req.url}`);

    await next();

    const duration = Date.now() - start;
    logger.info(`← ${req.method} ${req.url} ${duration}ms`);
  }
}
