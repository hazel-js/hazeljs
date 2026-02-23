import { Injectable } from '@hazeljs/core';
import { ModelRegistry } from '../registry/model.registry';
import { getPredictMetadata } from '../decorators';
import { PredictionResult } from '../ml.types';
import logger from '@hazeljs/core';

/**
 * Predictor Service - Real-time prediction/inference
 * Routes prediction requests to registered models
 */
@Injectable()
export class PredictorService {
  constructor(private readonly modelRegistry: ModelRegistry) {}

  async predict<T = unknown>(
    modelName: string,
    input: unknown,
    version?: string
  ): Promise<PredictionResult<T>> {
    const model = this.modelRegistry.get(modelName, version);
    if (!model) {
      throw new Error(`Model not found: ${modelName}`);
    }

    const predictMethod = model.predictMethod;
    if (!predictMethod) {
      throw new Error(`Model ${modelName} has no prediction method`);
    }

    const instance = model.instance as Record<
      string,
      (input: unknown) => Promise<PredictionResult<T>>
    >;
    const predictFn = instance[predictMethod];
    if (typeof predictFn !== 'function') {
      throw new Error(`Prediction method ${predictMethod} not found on model`);
    }

    logger.debug(`Running prediction for model: ${modelName}`);
    const result = await predictFn.call(instance, input);
    return result;
  }

  discoverPredictMethod(instance: object): string | undefined {
    const proto = Object.getPrototypeOf(instance);
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (descriptor?.value && typeof descriptor.value === 'function') {
        if (getPredictMetadata(proto, key)) {
          return key;
        }
      }
    }
    return undefined;
  }
}
