import { HazelApp } from '@hazeljs/core';
import { Type } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { ServerlessResponse, getServerlessMetadata } from './serverless.decorator';
import { ColdStartOptimizer } from './cold-start.optimizer';

/**
 * Google Cloud Function Request
 */
export interface CloudFunctionRequest {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string | string[]>;
  query: Record<string, string | string[]>;
  body?: unknown;
  rawBody?: Buffer;
}

/**
 * Google Cloud Function Response
 */
export interface CloudFunctionResponse {
  status(code: number): CloudFunctionResponse;
  set(field: string, value: string): CloudFunctionResponse;
  send(body: unknown): void;
  json(body: unknown): void;
  end(): void;
}

/**
 * Cloud Function adapter for HazelJS
 */
export class CloudFunctionAdapter {
  private app?: HazelApp;
  private optimizer: ColdStartOptimizer;
  private isColdStart = true;

  constructor(private moduleClass: Type<unknown>) {
    this.optimizer = ColdStartOptimizer.getInstance();
  }

  /**
   * Initialize the HazelJS application
   */
  private async initialize(): Promise<void> {
    if (this.app) {
      return;
    }

    const startTime = Date.now();
    logger.info('Initializing HazelJS application for Cloud Functions...');

    // Check if cold start optimization is enabled
    const metadata = getServerlessMetadata(this.moduleClass);
    if (metadata?.coldStartOptimization) {
      await this.optimizer.warmUp();
    }

    // Create HazelJS application
    this.app = new HazelApp(this.moduleClass);

    const duration = Date.now() - startTime;
    logger.info(`Cloud Function initialization completed in ${duration}ms`);
  }

  /**
   * Create Cloud Function HTTP handler
   */
  createHttpHandler() {
    return async (req: CloudFunctionRequest, res: CloudFunctionResponse): Promise<void> => {
      try {
        // Log cold start
        if (this.isColdStart) {
          logger.info('Cloud Function cold start detected');
          this.isColdStart = false;
        }

        // Initialize application
        await this.initialize();

        // Convert Cloud Function request to internal format
        const request = this.convertCloudFunctionRequest(req);

        // Process request through HazelJS
        const response = await this.processRequest(request);

        // Send response
        res.status(response.statusCode);

        if (response.headers) {
          Object.entries(response.headers).forEach(([key, value]) => {
            res.set(key, value);
          });
        }

        res.send(response.body);
      } catch (error) {
        logger.error('Cloud Function handler error:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };
  }

  /**
   * Create Cloud Function event handler (for Pub/Sub, Storage, etc.)
   */
  createEventHandler() {
    return async (event: unknown, context: unknown): Promise<void> => {
      try {
        // Log cold start
        if (this.isColdStart) {
          logger.info('Cloud Function event cold start detected');
          this.isColdStart = false;
        }

        // Initialize application
        await this.initialize();

        logger.info('Processing Cloud Function event:', {
          eventType: (context as { eventType?: string }).eventType,
          resource: (context as { resource?: string }).resource,
        });

        // Process event
        // In a real implementation, this would route to appropriate handlers
        logger.info('Event processed successfully');
      } catch (error) {
        logger.error('Cloud Function event handler error:', error);
        throw error;
      }
    };
  }

  /**
   * Convert Cloud Function request to internal format
   */
  private convertCloudFunctionRequest(req: CloudFunctionRequest): {
    method: string;
    url: string;
    path: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    body?: unknown;
    rawBody?: Buffer;
  } {
    return {
      method: req.method,
      url: req.url,
      path: req.path,
      headers: this.normalizeHeaders(req.headers),
      query: this.normalizeQuery(req.query),
      body: req.body,
      rawBody: req.rawBody,
    };
  }

  /**
   * Normalize headers (convert string[] to string)
   */
  private normalizeHeaders(headers: Record<string, string | string[]>): Record<string, string> {
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      normalized[key] = Array.isArray(value) ? value[0] : value;
    }

    return normalized;
  }

  /**
   * Normalize query parameters
   */
  private normalizeQuery(query: Record<string, string | string[]>): Record<string, string> {
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(query)) {
      normalized[key] = Array.isArray(value) ? value[0] : value;
    }

    return normalized;
  }

  /**
   * Process request through HazelJS router
   */
  private async processRequest(request: {
    method: string;
    url: string;
    path: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    body?: unknown;
    rawBody?: Buffer;
  }): Promise<ServerlessResponse> {
    if (!this.app) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Application not initialized' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const router = this.app.getRouter();

    // Build request context for the router
    const context = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      query: request.query,
      params: {} as Record<string, string>,
      body: request.body,
    };

    try {
      const route = await router.match(request.method, request.url, context);

      if (!route) {
        return {
          statusCode: 404,
          body: JSON.stringify({ statusCode: 404, message: 'Route not found' }),
          headers: { 'Content-Type': 'application/json' },
        };
      }

      // Create a synthetic request/response to capture the handler output
      const syntheticReq = {
        method: request.method,
        url: request.url,
        headers: request.headers,
        query: request.query,
        params: context.params || {},
        body: request.body,
      };

      let responseBody: unknown;
      let responseStatus = 200;
      const responseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

      interface SyntheticResponse {
        statusCode: number;
        status(code: number): SyntheticResponse;
        json(data: unknown): void;
        send(data: unknown): void;
        setHeader(key: string, value: string): void;
        getHeader(key: string): string | undefined;
      }

      const syntheticRes: SyntheticResponse = {
        statusCode: 200,
        status(code: number): SyntheticResponse {
          responseStatus = code;
          return syntheticRes;
        },
        json(data: unknown): void {
          responseBody = data;
          responseStatus = responseStatus || 200;
        },
        send(data: unknown): void {
          responseBody = data;
        },
        setHeader(key: string, value: string): void {
          responseHeaders[key] = value;
        },
        getHeader(key: string): string | undefined {
          return responseHeaders[key];
        },
      };

      const result = await route.handler(syntheticReq as never, syntheticRes as never);

      if (result !== undefined && responseBody === undefined) {
        responseBody = result;
      }

      return {
        statusCode: responseStatus,
        body: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
        headers: responseHeaders,
      };
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode || 500;
      const message = error instanceof Error ? error.message : 'Internal Server Error';

      return {
        statusCode,
        body: JSON.stringify({ statusCode, message }),
        headers: { 'Content-Type': 'application/json' },
      };
    }
  }

  /**
   * Get application instance
   */
  getApp(): HazelApp | undefined {
    return this.app;
  }

  /**
   * Check if this is a cold start
   */
  isCold(): boolean {
    return this.isColdStart;
  }
}

/**
 * Create a Cloud Function HTTP handler for a HazelJS module
 *
 * @example
 * ```typescript
 * // index.ts
 * import { createCloudFunctionHandler } from '@hazeljs/core';
 * import { AppModule } from './app.module';
 *
 * export const handler = createCloudFunctionHandler(AppModule);
 * ```
 */
export function createCloudFunctionHandler(
  moduleClass: Type<unknown>
): (req: CloudFunctionRequest, res: CloudFunctionResponse) => Promise<void> {
  const adapter = new CloudFunctionAdapter(moduleClass);
  return adapter.createHttpHandler();
}

/**
 * Create a Cloud Function event handler for a HazelJS module
 *
 * @example
 * ```typescript
 * // index.ts
 * import { createCloudFunctionEventHandler } from '@hazeljs/core';
 * import { AppModule } from './app.module';
 *
 * export const handler = createCloudFunctionEventHandler(AppModule);
 * ```
 */
export function createCloudFunctionEventHandler(
  moduleClass: Type<unknown>
): (event: unknown, context: unknown) => Promise<void> {
  const adapter = new CloudFunctionAdapter(moduleClass);
  return adapter.createEventHandler();
}
