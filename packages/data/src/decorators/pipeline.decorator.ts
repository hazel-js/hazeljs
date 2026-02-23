import 'reflect-metadata';
import logger from '@hazeljs/core';

const PIPELINE_METADATA_KEY = 'hazel:data:pipeline';

export interface PipelineOptions {
  name?: string;
}

/**
 * @Pipeline decorator - Mark a class as an ETL pipeline with sequential step execution
 *
 * @example
 * ```typescript
 * @Pipeline('user-enrichment')
 * @Injectable()
 * export class UserEnrichmentPipeline {
 *   @Transform({ step: 1, name: 'normalize' }) async normalize(data) { ... }
 *   @Validate({ step: 2, name: 'validate', schema: Schema.object({...}) }) async validate(data) { ... }
 *   @Transform({ step: 3, name: 'enrich' }) async enrich(data) { ... }
 * }
 * ```
 */
export function Pipeline(nameOrOptions?: string | PipelineOptions): ClassDecorator {
  return (target: object) => {
    const options: PipelineOptions =
      typeof nameOrOptions === 'string' ? { name: nameOrOptions } : nameOrOptions || {};
    const metadata = {
      name: options.name ?? target.constructor.name,
      ...options,
    };
    Reflect.defineMetadata(PIPELINE_METADATA_KEY, metadata, target);
    logger.debug(`Pipeline decorator applied: ${metadata.name}`);
  };
}

export function getPipelineMetadata(target: object): PipelineOptions | undefined {
  return Reflect.getMetadata(PIPELINE_METADATA_KEY, target);
}

export function hasPipelineMetadata(target: object): boolean {
  return Reflect.hasMetadata(PIPELINE_METADATA_KEY, target);
}
