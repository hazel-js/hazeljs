/**
 * @hazeljs/data - Data Processing & ETL for HazelJS
 */

import 'reflect-metadata';

// ─── Module ──────────────────────────────────────────────────────────────────
export { DataModule, type DataModuleOptions } from './data.module';

// ─── Schema ──────────────────────────────────────────────────────────────────
export { Schema } from './schema/schema';
export type {
  BaseSchema,
  StringSchema,
  NumberSchema,
  BooleanSchema,
  DateSchema,
  ObjectSchema,
  ArraySchema,
  LiteralSchema,
  UnionSchema,
  SchemaValidationError,
  SchemaValidator as SchemaValidatorFn,
  Infer,
} from './schema/schema';

// ─── Decorators ───────────────────────────────────────────────────────────────
export {
  Pipeline,
  Transform,
  Validate,
  Stream,
  // PII decorators
  Mask,
  Redact,
  Encrypt,
  Decrypt,
  // Metadata helpers
  getPipelineMetadata,
  hasPipelineMetadata,
  getTransformMetadata,
  getValidateMetadata,
  getStreamMetadata,
  hasStreamMetadata,
  getMaskMetadata,
  getRedactMetadata,
  // Types
  type PipelineOptions,
  type TransformOptions,
  type ValidateOptions,
  type StreamOptions,
  type MaskOptions,
  type RedactOptions,
  type EncryptOptions,
  type DecryptOptions,
} from './decorators';

// ─── Pipelines ────────────────────────────────────────────────────────────────
export {
  ETLService,
  type PipelineStep,
  type PipelineExecutionEvent,
  type PipelineEventHandler,
} from './pipelines/etl.service';
export { PipelineBase } from './pipelines/pipeline.base';
export {
  PipelineBuilder,
  type PipelineStepConfig,
  type PipelineDefinition,
  type SerializedStep,
} from './pipelines/pipeline.builder';
export { StreamService } from './pipelines/stream.service';

// ─── Streaming ────────────────────────────────────────────────────────────────
export { FlinkClient } from './streaming/flink/flink.client';
export { FlinkJob } from './streaming/flink/flink.job';
export {
  mapToFlinkOperator,
  createFlinkJobGraph,
  type FlinkOperator,
  type FlinkOperatorType,
} from './streaming/flink/flink.operators';
export { StreamBuilder } from './streaming/stream.builder';
export { StreamProcessor, type WindowedBatch } from './streaming/stream.processor';

// ─── Services ─────────────────────────────────────────────────────────────────
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
  type DataProfile,
  type FieldProfile,
  type AnomalyResult,
} from './quality/quality.service';

// ─── Connectors ───────────────────────────────────────────────────────────────
export type { DataSource, DataSink, ConnectorOptions } from './connectors/connector.interface';
export {
  CsvSource,
  CsvSink,
  type CsvSourceOptions,
  type CsvSinkOptions,
} from './connectors/csv.connector';
export {
  HttpSource,
  HttpSink,
  type HttpSourceOptions,
  type HttpSinkOptions,
} from './connectors/http.connector';
export { MemorySource, MemorySink } from './connectors/memory.connector';
export {
  JsonlSource,
  JsonlSink,
  type JsonlSourceOptions,
  type JsonlSinkOptions,
} from './connectors/jsonl.connector';
export {
  PostgresSource,
  PostgresSink,
  type PostgresSourceOptions,
  type PostgresSinkOptions,
} from './connectors/postgres.connector';

// ─── Data Contracts ───────────────────────────────────────────────────────────
export {
  ContractRegistry,
  DataContract,
  getDataContractMetadata,
  hasDataContractMetadata,
  type ContractStatus,
  type DataContractType,
  type DataContractSLA,
  type ContractViolation,
  type SchemaChange,
  type ContractDiff,
  type ContractValidationResult,
  type DataContractOptions,
  type DataContractMetadata,
} from './contracts';

// ─── Telemetry ────────────────────────────────────────────────────────────────
export {
  TelemetryService,
  createPrometheusExporter,
  type PipelineSpan,
  type MetricPoint,
  type LineageEntry,
  type SpanExporter,
  type MetricExporter,
} from './telemetry/telemetry';

// ─── Testing Utilities ────────────────────────────────────────────────────────
export {
  SchemaFaker,
  PipelineTestHarness,
  MockSource,
  MockSink,
  type StepSnapshot,
  type PipelineRunResult,
} from './testing';

// ─── Re-exports ───────────────────────────────────────────────────────────────
export { Injectable } from '@hazeljs/core';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  PipelineStepMetadata,
  StreamMetadata,
  FlinkJobConfig,
  FlinkAuthConfig,
  RetryConfig,
  DLQConfig,
} from './data.types';
export type { FlinkClientConfig, FlinkJobInfo } from './streaming/flink/flink.client';
