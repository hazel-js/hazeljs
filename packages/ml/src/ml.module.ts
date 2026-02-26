import { HazelModule, Injectable, Inject, Container, type Type } from '@hazeljs/core';
import { ModelRegistry } from './registry/model.registry';
import { TrainerService } from './training/trainer.service';
import { PipelineService } from './training/pipeline.service';
import { PredictorService } from './inference/predictor.service';
import { BatchService } from './inference/batch.service';
import { MetricsService } from './evaluation/metrics.service';
import { getModelMetadata } from './decorators';
import type { RegisteredModel } from './registry/model.registry';

export const ML_MODELS = Symbol('hazel:ml:models');

export interface MLModuleOptions {
  models?: Type<unknown>[];
}

/**
 * Bootstrap that registers models with the registry when instantiated.
 * Added as a provider when using MLModule.forRoot({ models: [...] }).
 */
@Injectable()
class MLModelBootstrap {
  constructor(
    private readonly modelRegistry: ModelRegistry,
    private readonly trainerService: TrainerService,
    private readonly predictorService: PredictorService,
    @Inject(ML_MODELS) private readonly modelTypes: Type<unknown>[]
  ) {
    const container = Container.getInstance();
    for (const ModelClass of this.modelTypes) {
      const metadata = getModelMetadata(ModelClass as object);
      if (!metadata) continue;

      const instance = container.resolve(ModelClass) as object;
      const trainMethod = this.trainerService.discoverTrainMethod(instance);
      const predictMethod = this.predictorService.discoverPredictMethod(instance);

      const registered: RegisteredModel = {
        metadata,
        instance,
        trainMethod,
        predictMethod,
      };
      this.modelRegistry.register(registered);
    }
  }
}

@HazelModule({
  providers: [
    ModelRegistry,
    TrainerService,
    PipelineService,
    PredictorService,
    BatchService,
    MetricsService,
  ],
  exports: [
    ModelRegistry,
    TrainerService,
    PipelineService,
    PredictorService,
    BatchService,
    MetricsService,
  ],
})
export class MLModule {
  private static options: MLModuleOptions = {};

  /**
   * Configure MLModule with models to register
   *
   * @example
   * ```typescript
   * imports: [
   *   MLModule.forRoot({
   *     models: [SentimentModel],
   *   }),
   * ]
   * ```
   */
  static forRoot(options: MLModuleOptions = {}): {
    module: typeof MLModule;
    providers: unknown[];
    exports: unknown[];
  } {
    MLModule.options = options;

    const models = options.models || [];
    const providers: unknown[] = [
      ModelRegistry,
      TrainerService,
      PipelineService,
      PredictorService,
      BatchService,
      MetricsService,
      ...models,
      { provide: ML_MODELS, useValue: models },
      MLModelBootstrap,
    ];

    return {
      module: MLModule,
      providers,
      exports: [
        ModelRegistry,
        TrainerService,
        PipelineService,
        PredictorService,
        BatchService,
        MetricsService,
      ],
    };
  }

  static getOptions(): MLModuleOptions {
    return MLModule.options;
  }
}
