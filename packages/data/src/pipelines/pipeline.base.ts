import { ETLService } from './etl.service';

/**
 * Base class for pipelines - provides execute() method
 * Extend this when using @Pipeline decorator for convenient execution
 *
 * @example
 * ```typescript
 * @Pipeline('user-enrichment')
 * @Injectable()
 * export class UserEnrichmentPipeline extends PipelineBase {
 *   constructor(etlService: ETLService) {
 *     super(etlService);
 *   }
 *   @Transform({ step: 1, name: 'normalize' }) async normalize(data) { ... }
 * }
 * // Usage: await pipeline.execute(rawUserData);
 * ```
 */
export abstract class PipelineBase {
  constructor(protected readonly etlService: ETLService) {}

  async execute<T = unknown>(input: unknown): Promise<T> {
    return this.etlService.execute<T>(this, input);
  }
}
