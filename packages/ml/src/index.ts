/**
 * @hazeljs/ml - Machine Learning & Model Management for HazelJS
 */

import 'reflect-metadata';

// Module
export { MLModule, ML_MODELS, type MLModuleOptions } from './ml.module';

// Decorators
export {
  Model,
  Train,
  Predict,
  getModelMetadata,
  hasModelMetadata,
  getTrainMetadata,
  hasTrainMetadata,
  getPredictMetadata,
  hasPredictMetadata,
  type TrainOptions,
  type PredictOptions,
} from './decorators';

// Registry
export {
  ModelRegistry,
  type RegisteredModel,
  type ArtifactPayload,
} from './registry/model.registry';

// Services
export { TrainerService } from './training/trainer.service';
export { PipelineService, type PipelineStep } from './training/pipeline.service';
export { PredictorService } from './inference/predictor.service';
export { BatchService, type BatchPredictionOptions } from './inference/batch.service';
export {
  MetricsService,
  type ModelMetrics,
  type EvaluationResult,
  type EvaluateOptions,
  type EvaluateMetric,
  type ConfusionMatrix,
} from './evaluation/metrics.service';

// Algorithms (pure TypeScript)
export {
  TfidfVectorizer,
  cosineSimilarity,
  NaiveBayesClassifier,
  LogisticRegression,
  IsolationForest,
  CosineKnn,
  ItemItemCF,
  jaroSimilarity,
  jaroWinkler,
  EntityResolver,
  HoltWinters,
  KMeans,
  DecisionTreeClassifier,
  type TfidfModel,
  type NaiveBayesModel,
  type LogisticRegressionModel,
  type IsolationForestModel as IsolationForestAlgoModel,
  type CosineKnnModel as CosineKnnAlgoModel,
  type ItemCFModel,
  type Neighbor,
  type MatchCandidate,
  type EntityResolverModel as EntityResolverAlgoModel,
  type HoltWintersModel as HoltWintersAlgoModel,
  type KMeansModel as KMeansAlgoModel,
  type DecisionTreeModel as DecisionTreeAlgoModel,
  type TreeNode,
} from './algorithms';

// Built-in @Model wrappers
export {
  TextNaiveBayesModel,
  TextLogisticRegressionModel,
  IsolationForestModel,
  CosineKnnModel,
  ItemItemCFModel,
  EntityResolverModel,
  HoltWintersModel,
  KMeansModel,
  DecisionTreeModel,
} from './models';

// Model registration helper
export { registerMLModel } from './ml-model.base';

// Training data helpers (optional @hazeljs/data peer)
export {
  prepareTrainingData,
  type PrepareTrainingDataOptions,
  type PreparedTrainingData,
} from './training/prepare-training-data';

// Re-export Injectable from core for convenience
export { Injectable } from '@hazeljs/core';

// Types
export type {
  MLFramework,
  ModelMetadata,
  TrainingData,
  TrainingResult,
  PredictionResult,
  ModelVersion,
} from './ml.types';

// Feature Store
export {
  FeatureStoreService,
  MemoryOnlineStore,
  RedisOnlineStore,
  FileOfflineStore,
  PostgresOfflineStore,
  createOnlineStore,
  createOfflineStore,
  Feature,
  FeatureView,
  getFeatureMetadata,
  hasFeatureMetadata,
  getFeatureViewMetadata,
  hasFeatureViewMetadata,
  type FeatureValueType,
  type FeatureMetadata,
  type FeatureValue,
  type FeatureViewType,
  type FeatureDefinition,
  type FeatureQuery,
  type FeatureResponse,
  type OnlineStoreConfig,
  type OfflineStoreConfig,
  type FeatureStoreConfig,
  type FeatureOptions,
  type FeatureViewOptions,
} from './features';

// Experiment Tracking
export {
  ExperimentService,
  Experiment,
  getExperimentMetadata,
  hasExperimentMetadata,
  type ExperimentType,
  type Run,
  type Artifact,
  type ExperimentConfig,
  type ExperimentOptions,
  type ExperimentMetadata,
} from './experiments';

// Monitoring & Drift Detection
export {
  DriftService,
  MonitorService,
  type DriftType,
  type DriftConfig,
  type DriftResult,
  type DriftReport,
  type DistributionStats,
  type MonitorConfig,
  type MonitorAlert,
  type AlertHandler,
} from './monitoring';
