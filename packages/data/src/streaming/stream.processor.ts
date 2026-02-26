import { ETLService } from '../pipelines/etl.service';
import logger from '@hazeljs/core';

/**
 * Stream Processor - In-process stream processing logic
 * Processes items through pipeline without Flink (for testing/simple use cases)
 */
export class StreamProcessor {
  constructor(private readonly etlService: ETLService) {}

  async processItem<T>(pipelineInstance: object, item: unknown): Promise<T> {
    return this.etlService.execute<T>(pipelineInstance, item);
  }

  async *processStream<T>(
    pipelineInstance: object,
    source: AsyncIterable<unknown>
  ): AsyncGenerator<T> {
    for await (const item of source) {
      try {
        yield await this.processItem<T>(pipelineInstance, item);
      } catch (error) {
        logger.error('Stream processor error:', error);
        throw error;
      }
    }
  }
}
