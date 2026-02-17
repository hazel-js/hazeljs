import { Type } from './types';
import { HazelModuleInstance, getModuleMetadata } from './hazel-module';
import { Container } from './container';
import { Router } from './router';
import { RequestParser } from './request-parser';
import { Server, IncomingMessage, ServerResponse } from 'http';
import logger from './logger';
import 'reflect-metadata';
import { Request, Response, RequestContext } from './types';
import { HttpError } from './errors/http.error';
import os from 'os';
import chalk from 'chalk';
import { ShutdownManager } from './shutdown';
import { HealthCheckManager, BuiltInHealthChecks } from './health';
import { TimeoutMiddleware, TimeoutOptions } from './middleware/timeout.middleware';
import { CorsOptions } from './middleware/cors.middleware';

const MODULE_METADATA_KEY = 'hazel:module';

class HttpResponse implements Response {
  private statusCode: number = 200;
  private headers: Record<string, string> = { 'Content-Type': 'application/json' };
  private headersSent: boolean = false;

  constructor(private res: ServerResponse) {}

  status(code: number): Response {
    this.statusCode = code;
    return this;
  }

  json(data: unknown): void {
    if (this.headersSent) return;
    this.headersSent = true;
    this.res.writeHead(this.statusCode, this.headers);
    this.res.end(JSON.stringify(data));
  }

  send(data: string | Buffer): void {
    if (!this.headersSent) {
      this.headersSent = true;
      this.res.writeHead(this.statusCode, this.headers);
    }
    this.res.write(data);
  }

  end(): void {
    if (!this.headersSent) {
      this.headersSent = true;
      this.res.writeHead(this.statusCode, this.headers);
    }
    this.res.end();
  }

  setHeader(name: string, value: string): void {
    if (!this.headersSent) {
      this.headers[name] = value;
    }
  }
}

export class HazelApp {
  private container: Container;
  private router: Router;
  private requestParser: RequestParser;
  private server: Server | null = null;
  private module: HazelModuleInstance;
  private shutdownManager: ShutdownManager;
  private healthManager: HealthCheckManager;
  private requestTimeout: number = 30000; // 30 seconds default
  private corsEnabled: boolean = false;
  private corsOptions?: CorsOptions;
  private timeoutMiddleware?: TimeoutMiddleware;

  constructor(private readonly moduleType: Type<unknown>) {
    logger.info('Initializing HazelApp');
    this.container = Container.getInstance();
    this.router = new Router(this.container);
    this.requestParser = new RequestParser();
    this.module = new HazelModuleInstance(this.moduleType);
    this.shutdownManager = new ShutdownManager();
    this.healthManager = new HealthCheckManager();
    
    // Register built-in health checks
    this.healthManager.registerCheck(BuiltInHealthChecks.memoryCheck());
    this.healthManager.registerCheck(BuiltInHealthChecks.eventLoopCheck());
    
    this.initialize();
  }

  private initialize(): void {
    logger.info('Initializing module:', { moduleName: this.moduleType.name });
    const metadata = Reflect.getMetadata(MODULE_METADATA_KEY, this.moduleType) || {};
    logger.debug('Module metadata:', metadata);

    // Collect all controllers from the module tree (root + imports, recursively)
    const allControllers = this.collectControllers(this.moduleType);

    // Register all controllers with the router
    if (allControllers.length > 0) {
      logger.info('Registering controllers:', {
        controllers: allControllers.map((c: Type<unknown>) => c.name),
      });
      allControllers.forEach((controller: Type<unknown>) => {
        this.router.registerController(controller);
      });
    }
  }

  private collectControllers(moduleType: Type<unknown>, visited = new Set<Type<unknown>>()): Type<unknown>[] {
    if (visited.has(moduleType)) return [];
    visited.add(moduleType);

    const metadata = getModuleMetadata(moduleType as object) || {};
    const controllers: Type<unknown>[] = [];

    // Collect from imported modules first
    if (metadata.imports) {
      for (const importedModule of metadata.imports) {
        controllers.push(...this.collectControllers(importedModule, visited));
      }
    }

    // Then collect from this module
    if (metadata.controllers) {
      controllers.push(...metadata.controllers);
    }

    return controllers;
  }

  register<T>(component: Type<T>): HazelApp {
    const instance = new component();
    this.container.register(component, instance);
    return this;
  }

  get(path: string, ...handlers: Array<(req: Request, res: Response) => void>): HazelApp {
    this.router.get(path, handlers);
    return this;
  }

  post(path: string, ...handlers: Array<(req: Request, res: Response) => void>): HazelApp {
    this.router.post(path, handlers);
    return this;
  }

  put(path: string, ...handlers: Array<(req: Request, res: Response) => void>): HazelApp {
    this.router.put(path, handlers);
    return this;
  }

  delete(path: string, ...handlers: Array<(req: Request, res: Response) => void>): HazelApp {
    this.router.delete(path, handlers);
    return this;
  }

  async listen(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.server = new Server(async (req: IncomingMessage, res: ServerResponse) => {
        try {
          if (!req.url) {
            logger.warn('Invalid URL received');
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid URL' }));
            return;
          }

          // Health check endpoints
          if (req.url === '/health' && req.method === 'GET') {
            const liveness = await this.healthManager.getLiveness();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(liveness));
            return;
          }

          if (req.url === '/ready' && req.method === 'GET') {
            const readiness = await this.healthManager.getReadiness();
            const statusCode = readiness.status === 'healthy' ? 200 : 503;
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(readiness));
            return;
          }

          if (req.url === '/startup' && req.method === 'GET') {
            const startup = await this.healthManager.getStartup();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(startup));
            return;
          }

          const { method, url, headers } = req;
          logger.debug('Incoming request:', { method, url, headers });

          // Handle CORS
          if (this.corsEnabled) {
            const origin = headers['origin'] || '*';
            const allowedOrigin = this.corsOptions?.origin
              ? (typeof this.corsOptions.origin === 'string' ? this.corsOptions.origin : origin)
              : '*';
            res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
            res.setHeader('Access-Control-Allow-Methods', this.corsOptions?.methods?.join(', ') || 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', this.corsOptions?.allowedHeaders?.join(', ') || 'Content-Type, Authorization');
            if (this.corsOptions?.credentials) {
              res.setHeader('Access-Control-Allow-Credentials', 'true');
            }
            if (this.corsOptions?.maxAge) {
              res.setHeader('Access-Control-Max-Age', String(this.corsOptions.maxAge));
            }

            // Handle preflight
            if (method === 'OPTIONS') {
              res.writeHead(204);
              res.end();
              return;
            }
          }

          // Parse request body for POST/PUT/PATCH requests (skip multipart - let route handle it)
          let body: unknown = undefined;
          const contentType = headers['content-type'] || '';
          const isMultipart = contentType.includes('multipart/form-data');
          if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && !isMultipart) {
            try {
              const chunks: Buffer[] = [];
              req.on('data', (chunk: Buffer) => chunks.push(chunk));
              await new Promise<void>((resolve, reject) => {
                req.on('end', () => {
                  try {
                    const bodyStr = Buffer.concat(chunks).toString();
                    if (bodyStr) {
                      if (contentType.includes('application/json')) {
                        body = JSON.parse(bodyStr);
                      } else if (contentType.includes('application/x-www-form-urlencoded')) {
                        const params = new URLSearchParams(bodyStr);
                        body = Object.fromEntries(params.entries());
                      } else {
                        body = bodyStr;
                      }
                    }
                    resolve();
                  } catch (error) {
                    reject(error);
                  }
                });
                req.on('error', reject);
              });
            } catch (error) {
              logger.error('Error parsing request body:', error);
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Invalid request body' }));
              return;
            }
          }

          // Extend the original request object
          Object.assign(req, {
            body,
            params: {},
            query: {},
          });

          let context;
          try {
            context = await RequestParser.parseRequest(req as Request);
            logger.debug('Parsed request context:', context);
          } catch (error: unknown) {
            if (error instanceof HttpError) {
              logger.error(
                `[${req.method}] ${req.url} - Request parsing error: ${error.message} (status: ${error.statusCode})`
              );
              if (process.env.NODE_ENV === 'development' && error.stack) {
                logger.debug(error.stack);
              }
              res.writeHead(error.statusCode, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  statusCode: error.statusCode,
                  message: error.message,
                  ...(error.errors && { errors: error.errors }),
                })
              );
              return;
            }
            throw error;
          }

          // Apply timeout middleware if configured
          if (this.timeoutMiddleware) {
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(new HttpError(408, 'Request Timeout'));
              }, this.requestTimeout);
            });
            // Wrap remaining logic in a race against timeout
            try {
              await Promise.race([this.handleRoute(req, res, context), timeoutPromise]);
            } catch (timeoutError) {
              if (timeoutError instanceof HttpError && timeoutError.statusCode === 408) {
                res.writeHead(408, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ statusCode: 408, message: 'Request Timeout' }));
              } else {
                throw timeoutError;
              }
            }
            return;
          }

          await this.handleRoute(req, res, context);
        } catch (error) {
          logger.error('Unhandled error:', error);

          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              statusCode: 500,
              message: 'Internal Server Error',
            })
          );
        }
      });

      this.server.listen(port, () => {
        const localIp = getLocalIp();
        logger.info(chalk.green.bold('Server listening on:'));
        logger.info('');
        logger.info(
          chalk.green('  → Local:    ') + chalk.cyan.underline(`http://localhost:${port}`)
        );
        logger.info(
          chalk.green('  → Network:  ') + chalk.cyan.underline(`http://${localIp}:${port}`)
        );
        logger.info('');
        logger.info(chalk.gray('Health endpoints:'));
        logger.info(chalk.gray(`  → /health  - Liveness probe`));
        logger.info(chalk.gray(`  → /ready   - Readiness probe`));
        logger.info(chalk.gray(`  → /startup - Startup probe`));
        logger.info('');
        
        // Setup graceful shutdown
        this.shutdownManager.setupSignalHandlers();
        
        // Register server shutdown handler
        this.shutdownManager.registerHandler({
          name: 'http-server',
          handler: async () => {
            logger.info('Closing HTTP server...');
            await this.close();
            logger.info('HTTP server closed');
          },
          timeout: 10000,
        });
        
        resolve();
      });
    });
  }

  private async handleRoute(req: IncomingMessage, res: ServerResponse, context: RequestContext): Promise<void> {
    let route;
    try {
      route = await this.router.match(req.method || 'GET', req.url || '/', context);
      if (!route) {
        if (req.url === '/.well-known/appspecific/com.chrome.devtools.json') {
          res.writeHead(404);
          res.end();
          return;
        }
        throw new Error('Route not found');
      }
    } catch (error: unknown) {
      const httpError = error as HttpError;
      logger.error(
        `[${req.method}] ${req.url} - Route matching error: ${httpError.message} (status: ${httpError.statusCode || 404})`
      );
      if (process.env.NODE_ENV === 'development' && httpError.stack) {
        logger.debug(httpError.stack);
      }
      const status = httpError.statusCode || 404;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          statusCode: status,
          message: httpError.message,
        })
      );
      return;
    }

    logger.info('Matched route:', {
      method: req.method,
      url: req.url,
      params: context.params,
    });

    try {
      const response = new HttpResponse(res);
      const result = await route.handler(req as Request, response);
      logger.debug('Request handled successfully:', result);

      if (result !== undefined) {
        response.json(result);
      }
    } catch (error: unknown) {
      logger.error('Error in route handler:', error instanceof HttpError);

      if (error instanceof HttpError) {
        logger.error('Error in route handler:', error.message);
        res.writeHead(error.statusCode, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            statusCode: error.statusCode,
            message: error.message,
            ...(error.errors && { errors: error.errors }),
          })
        );
        return;
      }

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          statusCode: 500,
          message: 'Internal Server Error',
        })
      );
    }
  }

  async close(): Promise<void> {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server?.close((err) => {
          if (err) {
            reject(err);
          } else {
            logger.info('Server closed successfully');
            resolve();
          }
        });
      });
    }
  }

  /**
   * Register a custom shutdown handler
   */
  registerShutdownHandler(handler: { name: string; handler: () => Promise<void>; timeout?: number }): void {
    this.shutdownManager.registerHandler(handler);
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(check: { name: string; check: () => Promise<{ status: 'healthy' | 'unhealthy' | 'degraded'; message?: string; details?: Record<string, unknown> }>; critical?: boolean; timeout?: number }): void {
    this.healthManager.registerCheck(check);
  }

  /**
   * Set request timeout
   */
  setRequestTimeout(timeout: number, options?: TimeoutOptions): void {
    this.requestTimeout = timeout;
    this.timeoutMiddleware = new TimeoutMiddleware({ ...options, timeout });
    logger.info(`Request timeout set to ${timeout}ms`);
  }

  /**
   * Enable CORS
   */
  enableCors(options?: CorsOptions): void {
    this.corsEnabled = true;
    this.corsOptions = options;
    logger.info('CORS enabled', options);
  }

  /**
   * Disable CORS
   */
  disableCors(): void {
    this.corsEnabled = false;
    this.corsOptions = undefined;
    logger.info('CORS disabled');
  }

  /**
   * Get health check manager
   */
  getHealthManager(): HealthCheckManager {
    return this.healthManager;
  }

  /**
   * Get shutdown manager
   */
  getShutdownManager(): ShutdownManager {
    return this.shutdownManager;
  }

  getContainer(): Container {
    return this.container;
  }

  getRouter(): Router {
    return this.router;
  }
}

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
