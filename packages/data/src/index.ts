/**
 * @hazeljs/data - Data Processing & ETL for HazelJS
 */

import 'reflect-metadata';

// Module
export { DataModule, type DataModuleOptions } from './data.module';

// Schema
export { Schema } from './schema/schema';
export type {
  BaseSchema,
  StringSchema,
  NumberSchema,
  ObjectSchema,
  SchemaValidationError,
} from './schema/schema';

// Decorators
export {
  Pipeline,
  Transform,
  Validate,
  Stream,
  getPipelineMetadata,
  hasPipelineMetadata,
  getTransformMetadata,
  getValidateMetadata,
  getStreamMetadata,
  hasStreamMetadata,
  type PipelineOptions,
  type TransformOptions,
  type ValidateOptions,
  type StreamOptions,
} from './decorators';

// Pipelines
export { ETLService, type PipelineStep } from './pipelines/etl.service';
export { PipelineBase } from './pipelines/pipeline.base';
export { PipelineBuilder, type PipelineStepConfig } from './pipelines/pipeline.builder';
export { StreamService } from './pipelines/stream.service';

// Streaming
export { FlinkClient } from './streaming/flink/flink.client';
export { FlinkJob } from './streaming/flink/flink.job';
export {
  mapToFlinkOperator,
  createFlinkJobGraph,
  type FlinkOperator,
  type FlinkOperatorType,
} from './streaming/flink/flink.operators';
export { StreamBuilder } from './streaming/stream.builder';
export { StreamProcessor } from './streaming/stream.processor';

// Services
export { FlinkService, type DeployStreamResult } from './flink.service';
export { SchemaValidator, SchemaValidationException } from './validators/schema.validator';
export { TransformerService } from './transformers/transformer.service';
export {
  trimString,
  toLowerCase,
  toUpperCase,
  parseJson,
  stringifyJson,
  pick,
  omit,
  renameKeys,
} from './transformers/built-in.transformers';
export {
  QualityService,
  type QualityCheckResult,
  type DataQualityReport,
} from './quality/quality.service';

// Re-export Injectable
export { Injectable } from '@hazeljs/core';

// Types
export type {
  PipelineStepMetadata,
  StreamMetadata,
  FlinkJobConfig,
  FlinkAuthConfig,
} from './data.types';
export type { FlinkClientConfig, FlinkJobInfo } from './streaming/flink/flink.client';
