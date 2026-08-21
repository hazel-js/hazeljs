import { HazelModule, Injectable, Inject, Container, type Type } from '@hazeljs/core';
import { ModelRegistry } from './registry/model.registry';
import { TrainerService } from './training/trainer.service';
import { PipelineService } from './training/pipeline.service';
import { PredictorService } from './inference/predictor.service';
import { BatchService } from './inference/batch.service';
import { MetricsService } from './evaluation/metrics.service';
import { FeatureStoreService } from './features/feature-store.service';
import { ExperimentService } from './experiments/experiment.service';
import { DriftService } from './monitoring/drift.service';
import { MonitorService } from './monitoring/monitor.service';
import { getModelMetadata } from './decorators';
import type { RegisteredModel } from './registry/model.registry';
import type { FeatureStoreConfig } from './features/feature.types';
import type { ExperimentConfig } from './experiments/experiment.types';

export const ML_MODELS = Symbol('hazel:ml:models');
export const ML_FEATURE_STORE_CONFIG = Symbol('hazel:ml:feature-store-config');
export const ML_EXPERIMENT_CONFIG = Symbol('hazel:ml:experiment-config');
export const ML_ARTIFACT_DIR = Symbol('hazel:ml:artifact-dir');

export interface MLModuleOptions {
  models?: Type<unknown>[];
  featureStore?: FeatureStoreConfig;
  experiments?: ExperimentConfig;
  /** Directory for model artifact JSON persistence */
  artifactDir?: string;
}

/**
 * Bootstrap that registers models with the registry when instantiated.
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

@Injectable()
class MLConfigBootstrap {
  constructor(
    private readonly featureStore: FeatureStoreService,
    private readonly experimentService: ExperimentService,
    private readonly modelRegistry: ModelRegistry,
    @Inject(ML_FEATURE_STORE_CONFIG) featureConfig: FeatureStoreConfig | null,
    @Inject(ML_EXPERIMENT_CONFIG) experimentConfig: ExperimentConfig | null,
    @Inject(ML_ARTIFACT_DIR) artifactDir: string | null
  ) {
    if (featureConfig) {
      this.featureStore.configure(featureConfig);
    }
    if (experimentConfig) {
      this.experimentService.configure(experimentConfig);
    }
    if (artifactDir) {
      this.modelRegistry.configurePersistence(artifactDir);
    }
  }
}

const CORE_PROVIDERS = [
  ModelRegistry,
  PipelineService,
  TrainerService,
  PredictorService,
  BatchService,
  MetricsService,
  FeatureStoreService,
  ExperimentService,
  DriftService,
  MonitorService,
];

@HazelModule({
  providers: [...CORE_PROVIDERS],
  exports: [...CORE_PROVIDERS],
})
export class MLModule {
  private static options: MLModuleOptions = {};

  /**
   * Configure MLModule with models and optional MLOps services.
   *
   * @example
   * ```typescript
   * imports: [
   *   MLModule.forRoot({
   *     models: [TextNaiveBayesModel, IsolationForestModel],
   *     artifactDir: './models',
   *     experiments: { storage: 'memory' },
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
      ...CORE_PROVIDERS,
      ...models,
      { provide: ML_MODELS, useValue: models },
      { provide: ML_FEATURE_STORE_CONFIG, useValue: options.featureStore ?? null },
      { provide: ML_EXPERIMENT_CONFIG, useValue: options.experiments ?? null },
      { provide: ML_ARTIFACT_DIR, useValue: options.artifactDir ?? null },
      MLModelBootstrap,
      MLConfigBootstrap,
    ];

    return {
      module: MLModule,
      providers,
      exports: [...CORE_PROVIDERS],
    };
  }

  static getOptions(): MLModuleOptions {
    return MLModule.options;
  }
}
