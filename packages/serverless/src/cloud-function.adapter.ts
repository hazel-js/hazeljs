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
   * Process request through HazelJS
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
    // In a real implementation, this would route through the HazelJS router
    // For now, return a simple response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Hello from HazelJS on Cloud Functions!',
        request: {
          method: request.method,
          url: request.url,
        },
        coldStart: this.isColdStart,
        warmupDuration: this.optimizer.getWarmupDuration(),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
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
