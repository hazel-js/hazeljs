import 'reflect-metadata';
import logger from '@hazeljs/core';

/**
 * Serverless configuration options
 */
export interface ServerlessOptions {
  /**
   * Memory allocation in MB
   * @default 512
   */
  memory?: number;

  /**
   * Timeout in seconds
   * @default 30
   */
  timeout?: number;

  /**
   * Enable cold start optimization
   * @default true
   */
  coldStartOptimization?: boolean;

  /**
   * Environment variables
   */
  environment?: Record<string, string>;

  /**
   * Runtime platform
   */
  runtime?: 'aws-lambda' | 'gcp-functions' | 'azure-functions' | 'cloudflare-workers';

  /**
   * Enable automatic function splitting
   * @default false
   */
  autoSplit?: boolean;

  /**
   * Reserved concurrent executions (AWS Lambda)
   */
  reservedConcurrency?: number;

  /**
   * Provisioned concurrency (AWS Lambda)
   */
  provisionedConcurrency?: number;
}

const SERVERLESS_METADATA_KEY = 'hazel:serverless';

/**
 * Decorator to mark a controller as serverless-optimized
 *
 * @example
 * ```typescript
 * @Serverless({
 *   memory: 512,
 *   timeout: 30,
 *   coldStartOptimization: true
 * })
 * @Controller('/lambda')
 * export class LambdaController {
 *   @Get()
 *   async handler() {
 *     return { message: 'Hello from serverless!' };
 *   }
 * }
 * ```
 */
export function Serverless(options: ServerlessOptions = {}): ClassDecorator {
  return (target: object | (new (...args: unknown[]) => object)) => {
    const defaults: ServerlessOptions = {
      memory: 512,
      timeout: 30,
      coldStartOptimization: true,
      autoSplit: false,
      ...options,
    };

    const targetName = typeof target === 'function' ? target.name : 'unknown';
    logger.debug(`Marking ${targetName} as serverless with options:`, defaults);
    Reflect.defineMetadata(SERVERLESS_METADATA_KEY, defaults, target);
  };
}

/**
 * Get serverless metadata from a class
 */
export function getServerlessMetadata(
  target: object | (new (...args: unknown[]) => object)
): ServerlessOptions | undefined {
  return Reflect.getMetadata(SERVERLESS_METADATA_KEY, target);
}

/**
 * Check if a class is marked as serverless
 */
export function isServerless(target: object | (new (...args: unknown[]) => object)): boolean {
  return Reflect.hasMetadata(SERVERLESS_METADATA_KEY, target);
}

/**
 * Serverless function handler type
 */
export type ServerlessHandler<TEvent = unknown, TResult = unknown> = (
  event: TEvent,
  context: ServerlessContext
) => Promise<TResult> | TResult;

/**
 * Serverless execution context
 */
export interface ServerlessContext {
  /**
   * Request ID
   */
  requestId: string;

  /**
   * Function name
   */
  functionName: string;

  /**
   * Function version
   */
  functionVersion: string;

  /**
   * Memory limit in MB
   */
  memoryLimitInMB: number;

  /**
   * Remaining time in milliseconds
   */
  getRemainingTimeInMillis(): number;

  /**
   * Log stream name
   */
  logStreamName?: string;

  /**
   * Log group name
   */
  logGroupName?: string;

  /**
   * Additional platform-specific context
   */
  [key: string]: unknown;
}

/**
 * Serverless event types
 */
export interface ServerlessEvent {
  /**
   * HTTP method
   */
  httpMethod?: string;

  /**
   * Request path
   */
  path?: string;

  /**
   * Query parameters
   */
  queryStringParameters?: Record<string, string>;

  /**
   * Headers
   */
  headers?: Record<string, string>;

  /**
   * Request body
   */
  body?: string;

  /**
   * Is base64 encoded
   */
  isBase64Encoded?: boolean;

  /**
   * Additional platform-specific event data
   */
  [key: string]: unknown;
}

/**
 * Serverless response
 */
export interface ServerlessResponse {
  /**
   * Status code
   */
  statusCode: number;

  /**
   * Response headers
   */
  headers?: Record<string, string>;

  /**
   * Response body
   */
  body: string;

  /**
   * Is base64 encoded
   */
  isBase64Encoded?: boolean;
}
