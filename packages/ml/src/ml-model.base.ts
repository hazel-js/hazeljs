import { ModelRegistry } from './registry/model.registry';
import { getModelMetadata } from './decorators';
import { TrainerService } from './training/trainer.service';
import { PredictorService } from './inference/predictor.service';
import type { RegisteredModel } from './registry/model.registry';

/**
 * Registers an ML model instance with the registry.
 * Call this from your model's constructor when injecting ModelRegistry.
 *
 * @example
 * ```typescript
 * @Model({ name: 'sentiment', version: '1.0.0', framework: 'tensorflow' })
 * @Injectable()
 * class SentimentModel extends MLModelBase {
 *   constructor(registry: ModelRegistry, trainer: TrainerService, predictor: PredictorService) {
 *     super(registry, trainer, predictor);
 *   }
 * }
 * ```
 */
export function registerMLModel(
  instance: object,
  registry: ModelRegistry,
  trainerService: TrainerService,
  predictorService: PredictorService
): void {
  const metadata = getModelMetadata(instance.constructor);
  if (!metadata) return;

  const trainMethod = trainerService.discoverTrainMethod(instance);
  const predictMethod = predictorService.discoverPredictMethod(instance);

  const registered: RegisteredModel = {
    metadata,
    instance,
    trainMethod,
    predictMethod,
  };
  registry.register(registered);
}
