/**
 * @hazeljs/ml - Type definitions for ML models and operations
 */

export type MLFramework = 'tensorflow' | 'onnx' | 'custom';

export interface ModelMetadata {
  name: string;
  version: string;
  framework: MLFramework;
  description?: string;
  tags?: string[];
}

export interface TrainingData {
  [key: string]: unknown;
}

export interface TrainingResult {
  accuracy?: number;
  loss?: number;
  metrics?: Record<string, number>;
  modelPath?: string;
}

export interface PredictionResult<T = unknown> {
  [key: string]: T;
}

export interface ModelVersion {
  version: string;
  createdAt: Date;
  path?: string;
  metrics?: Record<string, number>;
}
