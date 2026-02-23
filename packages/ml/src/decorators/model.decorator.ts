import 'reflect-metadata';
import { ModelMetadata } from '../ml.types';
import logger from '@hazeljs/core';

const MODEL_METADATA_KEY = 'hazel:ml:model';

/**
 * @Model decorator - Register ML models with the registry
 *
 * @example
 * ```typescript
 * @Model({
 *   name: 'sentiment-classifier',
 *   version: '1.0.0',
 *   framework: 'tensorflow',
 * })
 * @Injectable()
 * export class SentimentModel {
 *   @Train()
 *   async train(data: TrainingData) { ... }
 *
 *   @Predict()
 *   async predict(text: string) { ... }
 * }
 * ```
 */
export function Model(config: ModelMetadata): ClassDecorator {
  return (target: object) => {
    const metadata: ModelMetadata = {
      description: '',
      tags: [],
      ...config,
    };

    Reflect.defineMetadata(MODEL_METADATA_KEY, metadata, target);
    logger.debug(`Model decorator applied: ${metadata.name}@${metadata.version}`);
  };
}

export function getModelMetadata(target: object): ModelMetadata | undefined {
  return Reflect.getMetadata(MODEL_METADATA_KEY, target);
}

export function hasModelMetadata(target: object): boolean {
  return Reflect.hasMetadata(MODEL_METADATA_KEY, target);
}
