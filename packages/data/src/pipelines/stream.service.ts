import { Injectable } from '@hazeljs/core';
import { ETLService } from './etl.service';
import { getStreamMetadata } from '../decorators';
import logger from '@hazeljs/core';

/**
 * Stream Service - Streaming pipeline execution
 * Processes data through pipeline steps (for in-process streaming, not Flink deployment)
 */
@Injectable()
export class StreamService {
  constructor(private readonly etlService: ETLService) {}

  async *processStream<T = unknown>(
    pipelineInstance: object,
    source: AsyncIterable<unknown>
  ): AsyncGenerator<T> {
    const metadata = getStreamMetadata(pipelineInstance.constructor);
    if (!metadata) {
      throw new Error('Pipeline is not decorated with @Stream');
    }

    logger.debug(`Processing stream ${metadata.name}`);

    for await (const item of source) {
      try {
        const result = await this.etlService.execute<T>(pipelineInstance, item);
        yield result;
      } catch (error) {
        logger.error(`Stream ${metadata.name} error processing item:`, error);
        throw error;
      }
    }
  }

  async processBatch<T = unknown>(pipelineInstance: object, items: unknown[]): Promise<T[]> {
    const results: T[] = [];
    for (const item of items) {
      const result = await this.etlService.execute<T>(pipelineInstance, item);
      results.push(result);
    }
    return results;
  }
}
