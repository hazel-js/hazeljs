import 'reflect-metadata';
import logger from '@hazeljs/core';
import type { StreamMetadata } from '../data.types';

const STREAM_METADATA_KEY = 'hazel:data:stream';

export interface StreamOptions {
  name: string;
  source: string;
  sink: string;
  parallelism?: number;
}

/**
 * @Stream decorator - Streaming pipeline with Flink
 * For real-time stream processing
 *
 * @example
 * ```typescript
 * @Stream({
 *   name: 'user-events-stream',
 *   source: 'kafka://user-events',
 *   sink: 'kafka://processed-events',
 *   parallelism: 4,
 * })
 * @Injectable()
 * export class UserEventsStreamPipeline {
 *   @Transform({ step: 1, name: 'parse' }) async parseEvent(event) { ... }
 *   @Transform({ step: 2, name: 'enrich' }) async enrich(event) { ... }
 * }
 * ```
 */
export function Stream(options: StreamOptions): ClassDecorator {
  return (target: object) => {
    const metadata: StreamMetadata = {
      name: options.name,
      source: options.source,
      sink: options.sink,
      parallelism: options.parallelism ?? 4,
    };
    Reflect.defineMetadata(STREAM_METADATA_KEY, metadata, target);
    logger.debug(`Stream decorator applied: ${metadata.name}`);
  };
}

export function getStreamMetadata(target: object): StreamMetadata | undefined {
  return Reflect.getMetadata(STREAM_METADATA_KEY, target);
}

export function hasStreamMetadata(target: object): boolean {
  return Reflect.hasMetadata(STREAM_METADATA_KEY, target);
}
