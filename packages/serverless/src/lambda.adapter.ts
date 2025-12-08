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
 * Lambda adapter for HazelJS
 */
export class LambdaAdapter {
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
    logger.info('Initializing HazelJS application for Lambda...');

    // Check if cold start optimization is enabled
    const metadata = getServerlessMetadata(this.moduleClass);
    if (metadata?.coldStartOptimization) {
      await this.optimizer.warmUp();
    }

    // Create HazelJS application
    this.app = new HazelApp(this.moduleClass);

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
   * Process request through HazelJS
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
    // In a real implementation, this would route through the HazelJS router
    // For now, return a simple response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Hello from HazelJS on Lambda!',
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
  moduleClass: Type<unknown>
): (event: LambdaEvent, context: LambdaContext) => Promise<ServerlessResponse> {
  const adapter = new LambdaAdapter(moduleClass);
  return adapter.createHandler();
}
