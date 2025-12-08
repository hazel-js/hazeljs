import { Type } from './types';
import { HazelModuleInstance } from './hazel-module';
import { Container } from './container';
import { Router } from './router';
import { RequestParser } from './request-parser';
import { Server, IncomingMessage, ServerResponse } from 'http';
import logger from './logger';
import 'reflect-metadata';
import { Request, Response } from './types';
import { HttpError } from './errors/http.error';
import os from 'os';
import chalk from 'chalk';

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

  constructor(private readonly moduleType: Type<unknown>) {
    logger.info('Initializing HazelApp');
    this.container = Container.getInstance();
    this.router = new Router(this.container);
    this.requestParser = new RequestParser();
    this.module = new HazelModuleInstance(this.moduleType);
    this.initialize();
  }

  private initialize(): void {
    logger.info('Initializing module:', { moduleName: this.moduleType.name });
    const metadata = Reflect.getMetadata(MODULE_METADATA_KEY, this.moduleType) || {};
    logger.debug('Module metadata:', metadata);

    // Initialize imported modules first
    if (metadata.imports) {
      logger.info('Initializing imported modules:', {
        modules: metadata.imports.map((m: Type<unknown>) => m.name),
      });
      metadata.imports.forEach((moduleType: Type<unknown>) => {
        const importedMetadata = Reflect.getMetadata(MODULE_METADATA_KEY, moduleType) || {};
        if (importedMetadata.controllers) {
          importedMetadata.controllers.forEach((controller: Type<unknown>) => {
            this.router.registerController(controller);
          });
        }
      });
    }

    // Register controllers from the current module
    if (metadata.controllers) {
      logger.info('Registering controllers:', {
        controllers: metadata.controllers.map((c: Type<unknown>) => c.name),
      });
      metadata.controllers.forEach((controller: Type<unknown>) => {
        this.router.registerController(controller);
      });
    }
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

          const { method, url, headers } = req;
          logger.info('Incoming request:', { method, url, headers });

          // Parse request body for POST/PUT requests
          let body: unknown = undefined;
          if (method === 'POST' || method === 'PUT') {
            try {
              const chunks: Buffer[] = [];
              req.on('data', (chunk: Buffer) => chunks.push(chunk));
              await new Promise<void>((resolve, reject) => {
                req.on('end', () => {
                  try {
                    const bodyStr = Buffer.concat(chunks).toString();
                    if (bodyStr) {
                      const contentType = headers['content-type'] || '';
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

          let route;
          try {
            route = await this.router.match(req.method || 'GET', req.url || '/', context);
            if (!route) {
              // Handle Chrome DevTools request gracefully
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

            // Handle unknown errors
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                statusCode: 500,
                message: 'Internal Server Error',
              })
            );
          }
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
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server?.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }

  getContainer(): Container {
    return this.container;
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
