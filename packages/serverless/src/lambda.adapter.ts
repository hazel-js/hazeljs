import { HazelApp } from '@hazeljs/core';
import { Type } from '@hazeljs/core';
import logger from '@hazeljs/core';
import {
  ServerlessEvent,
  ServerlessResponse,
  ServerlessContext,
  getServerlessMetadata,
} from './serverless.decorator';
import { ColdStartOptimizer } from './cold-start.optimizer';

/**
 * AWS Lambda event types
 */
export interface LambdaEvent extends ServerlessEvent {
  resource?: string;
  pathParameters?: Record<string, string>;
  stageVariables?: Record<string, string>;
  requestContext?: {
    accountId: string;
    apiId: string;
    protocol: string;
    httpMethod: string;
    path: string;
    stage: string;
    requestId: string;
    requestTime: string;
    requestTimeEpoch: number;
    identity: {
      sourceIp: string;
      userAgent: string;
    };
  };
}

/**
 * AWS Lambda context
 */
export interface LambdaContext extends ServerlessContext {
  awsRequestId: string;
  invokedFunctionArn: string;
  callbackWaitsForEmptyEventLoop: boolean;
}

/**
 * Options for createLambdaHandler
 */
export interface LambdaHandlerOptions {
  /** Called after the HazelJS app is initialized (e.g. for custom setup). */
  onInit?: (app: HazelApp) => Promise<void>;
  /** Called when the handler throws (e.g. for custom logging or reporting). */
  onError?: (error: unknown) => void;
  /** MIME types (e.g. 'image/png', 'image/*') that trigger base64 encoding of Buffer body for Lambda. */
  binaryMimeTypes?: string[];
}

/**
 * Lambda adapter for HazelJS
 */
export class LambdaAdapter {
  private app?: HazelApp;
  private optimizer: ColdStartOptimizer;
  private isColdStart = true;

  constructor(
    private moduleClass: Type<unknown>,
    private options: LambdaHandlerOptions = {}
  ) {
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
    logger.info('Initializing HazelJS application for Lambda...');

    // Check if cold start optimization is enabled
    const metadata = getServerlessMetadata(this.moduleClass);
    if (metadata?.coldStartOptimization) {
      await this.optimizer.warmUp();
    }

    // Create HazelJS application
    this.app = new HazelApp(this.moduleClass);

    if (this.options.onInit && this.app) {
      await this.options.onInit(this.app);
    }

    const duration = Date.now() - startTime;
    logger.info(`Lambda initialization completed in ${duration}ms`);
  }

  /**
   * Create Lambda handler
   */
  createHandler() {
    return async (event: LambdaEvent, context: LambdaContext): Promise<ServerlessResponse> => {
      try {
        // Log cold start
        if (this.isColdStart) {
          logger.info('Lambda cold start detected');
          this.isColdStart = false;
        }

        // Initialize application
        await this.initialize();

        // Convert Lambda event to HTTP request
        const request = this.convertLambdaEventToRequest(event, context);

        // Process request through HazelJS
        const response = await this.processRequest(request);

        return response;
      } catch (error) {
        this.options.onError?.(error);
        logger.error('Lambda handler error:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        };
      }
    };
  }

  /**
   * Convert Lambda event to HTTP request format
   */
  private convertLambdaEventToRequest(
    event: LambdaEvent,
    context: LambdaContext
  ): {
    method: string;
    url: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    params: Record<string, string>;
    body?: unknown;
    context: {
      requestId: string;
      functionName: string;
      remainingTime: number;
    };
  } {
    return {
      method: event.httpMethod || 'GET',
      url: event.path || '/',
      headers: event.headers || {},
      query: event.queryStringParameters || {},
      params: event.pathParameters || {},
      body: event.body ? this.parseBody(event.body, event.isBase64Encoded) : undefined,
      context: {
        requestId: context.awsRequestId,
        functionName: context.functionName,
        remainingTime: context.getRemainingTimeInMillis(),
      },
    };
  }

  /**
   * Parse request body
   */
  private parseBody(body: string, isBase64Encoded?: boolean): unknown {
    try {
      if (isBase64Encoded) {
        const decoded = Buffer.from(body, 'base64').toString('utf-8');
        return JSON.parse(decoded);
      }
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  /**
   * Process request through HazelJS router
   */
  private async processRequest(request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    params: Record<string, string>;
    body?: unknown;
    context: {
      requestId: string;
      functionName: string;
      remainingTime: number;
    };
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
      params: request.params,
      body: request.body,
      requestId: request.context.requestId,
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
        params: route.context?.params ?? context.params ?? {},
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

      const result = await route.handler(
        syntheticReq as never,
        syntheticRes as never,
        route.context as never
      );

      // If handler returned a value directly, use it
      if (result !== undefined && responseBody === undefined) {
        responseBody = result;
      }

      const contentType = responseHeaders['content-type'] ?? responseHeaders['Content-Type'] ?? '';
      const isBinary =
        this.options.binaryMimeTypes?.length &&
        this.isBinaryContentType(contentType) &&
        (Buffer.isBuffer(responseBody) || responseBody instanceof Uint8Array);

      let body: string;
      let isBase64Encoded = false;
      if (isBinary) {
        body = Buffer.from(responseBody as Buffer).toString('base64');
        isBase64Encoded = true;
      } else {
        body = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
      }

      return {
        statusCode: responseStatus,
        body,
        headers: responseHeaders,
        ...(isBase64Encoded && { isBase64Encoded: true }),
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
   * Whether the given Content-Type matches any of the binaryMimeTypes patterns.
   */
  private isBinaryContentType(contentType: string): boolean {
    if (!this.options.binaryMimeTypes?.length || !contentType) return false;
    const ct = contentType.split(';')[0].trim().toLowerCase();
    for (const pattern of this.options.binaryMimeTypes) {
      const p = pattern.toLowerCase();
      if (p.endsWith('/*')) {
        if (ct.startsWith(p.slice(0, -1))) return true;
      } else if (ct === p || ct.startsWith(p + '/')) {
        return true;
      }
    }
    return false;
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
 * Create a Lambda handler for a HazelJS module
 *
 * @example
 * ```typescript
 * // handler.ts
 * import { createLambdaHandler } from '@hazeljs/core';
 * import { AppModule } from './app.module';
 *
 * export const handler = createLambdaHandler(AppModule);
 * ```
 */
export function createLambdaHandler(
  moduleClass: Type<unknown>,
  options?: LambdaHandlerOptions
): (event: LambdaEvent, context: LambdaContext) => Promise<ServerlessResponse> {
  const adapter = new LambdaAdapter(moduleClass, options ?? {});
  return adapter.createHandler();
}
