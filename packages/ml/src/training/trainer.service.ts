import { Injectable } from '@hazeljs/core';
import { ModelRegistry } from '../registry/model.registry';
import { getModelMetadata, getTrainMetadata } from '../decorators';
import { TrainingData, TrainingResult } from '../ml.types';
import logger from '@hazeljs/core';

/**
 * Trainer Service - Training orchestration for ML models
 * Coordinates training pipelines and model updates
 */
@Injectable()
export class TrainerService {
  constructor(private readonly modelRegistry: ModelRegistry) {}

  async train(modelName: string, data: TrainingData, version?: string): Promise<TrainingResult> {
    const model = this.modelRegistry.get(modelName, version);
    if (!model) {
      throw new Error(`Model not found: ${modelName}`);
    }

    const trainMethod = model.trainMethod;
    if (!trainMethod) {
      throw new Error(`Model ${modelName} has no training method`);
    }

    const instance = model.instance as Record<
      string,
      (data: TrainingData) => Promise<TrainingResult>
    >;
    const trainFn = instance[trainMethod];
    if (typeof trainFn !== 'function') {
      throw new Error(`Training method ${trainMethod} not found on model`);
    }

    logger.debug(`Starting training for model: ${modelName}`);
    const result = await trainFn.call(instance, data);
    logger.debug(`Training completed for model: ${modelName}`, result);

    return result;
  }

  discoverTrainMethod(instance: object): string | undefined {
    const metadata = getModelMetadata(instance.constructor);
    if (!metadata) return undefined;

    const proto = Object.getPrototypeOf(instance);
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (descriptor?.value && typeof descriptor.value === 'function') {
        if (getTrainMetadata(proto, key)) {
          return key;
        }
      }
    }
    return undefined;
  }
}
