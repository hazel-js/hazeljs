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
export { ModelRegistry, type RegisteredModel } from './registry/model.registry';

// Services
export { TrainerService } from './training/trainer.service';
export { PipelineService, type PipelineStep } from './training/pipeline.service';
export { PredictorService } from './inference/predictor.service';
export { BatchService, type BatchPredictionOptions } from './inference/batch.service';
export {
  MetricsService,
  type ModelMetrics,
  type EvaluationResult,
} from './evaluation/metrics.service';

// Model registration helper
export { registerMLModel } from './ml-model.base';

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
