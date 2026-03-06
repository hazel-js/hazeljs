import { Service } from '@hazeljs/core';
import { ModelRegistry } from '../registry/model.registry';
import { PredictorService } from '../inference/predictor.service';
import { PredictionResult } from '../ml.types';
import logger from '@hazeljs/core';

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  loss?: number;
  [key: string]: number | undefined;
}

export interface EvaluationResult {
  modelName: string;
  version: string;
  metrics: ModelMetrics;
  evaluatedAt: Date;
}

export type EvaluateMetric = 'accuracy' | 'f1' | 'precision' | 'recall';

export interface EvaluateOptions {
  metrics?: EvaluateMetric[];
  labelKey?: string;
  predictionKey?: string;
  version?: string;
}

/**
 * Metrics Service - Model evaluation and metrics
 * Tracks model performance for A/B testing and monitoring
 */
@Service()
export class MetricsService {
  constructor(
    private readonly modelRegistry?: ModelRegistry,
    private readonly predictorService?: PredictorService
  ) {}

  private metrics: Map<string, EvaluationResult[]> = new Map();

  recordEvaluation(result: EvaluationResult): void {
    const key = result.modelName;
    const existing = this.metrics.get(key) || [];
    existing.push(result);
    this.metrics.set(key, existing);
    logger.debug(`Recorded evaluation for ${key}@${result.version}`);
  }

  getMetrics(modelName: string, version?: string): EvaluationResult | undefined {
    const results = this.metrics.get(modelName) || [];
    if (version) {
      return results.find((r) => r.version === version);
    }
    return results[results.length - 1];
  }

  getHistory(modelName: string): EvaluationResult[] {
    return this.metrics.get(modelName) || [];
  }

  compareVersions(
    modelName: string,
    versionA: string,
    versionB: string
  ): {
    a: EvaluationResult | undefined;
    b: EvaluationResult | undefined;
    winner?: string;
  } {
    const results = this.metrics.get(modelName) || [];
    const a = results.find((r) => r.version === versionA);
    const b = results.find((r) => r.version === versionB);

    let winner: string | undefined;
    if (a?.metrics.accuracy !== undefined && b?.metrics.accuracy !== undefined) {
      winner = a.metrics.accuracy >= b.metrics.accuracy ? versionA : versionB;
    }

    return { a, b, winner };
  }

  /**
   * Evaluate model on test data by running predictions and computing metrics.
   * Requires PredictorService to be injected.
   *
   * @param modelName - Registered model name
   * @param testData - Array of samples. Each sample must contain the model input and a label key.
   * @param options - labelKey (default: 'label'), predictionKey (tries 'label'|'sentiment'|'class'), metrics, version
   */
  async evaluate(
    modelName: string,
    testData: Record<string, unknown>[],
    options: EvaluateOptions = {}
  ): Promise<EvaluationResult> {
    if (!this.predictorService) {
      throw new Error(
        'MetricsService.evaluate() requires PredictorService. Ensure MLModule is configured with PredictorService.'
      );
    }

    const {
      metrics: requestedMetrics = ['accuracy', 'f1', 'precision', 'recall'],
      labelKey = 'label',
      predictionKey,
      version,
    } = options;

    if (testData.length === 0) {
      throw new Error('testData cannot be empty');
    }

    const predictions: PredictionResult<unknown>[] = [];
    for (const sample of testData) {
      const { [labelKey]: _label, ...input } = sample;
      const pred = await this.predictorService.predict(modelName, input, version);
      predictions.push(pred);
    }

    const labels = testData.map((s) => String(s[labelKey] ?? ''));
    const predictedLabels = predictions.map((p) => this.extractPredictedLabel(p, predictionKey));

    const computed: ModelMetrics = {};
    if (requestedMetrics.includes('accuracy')) {
      computed.accuracy = this.computeAccuracy(labels, predictedLabels);
    }
    if (
      requestedMetrics.includes('precision') ||
      requestedMetrics.includes('recall') ||
      requestedMetrics.includes('f1')
    ) {
      const { precision, recall, f1Score } = this.computePrecisionRecallF1(labels, predictedLabels);
      if (requestedMetrics.includes('precision')) computed.precision = precision;
      if (requestedMetrics.includes('recall')) computed.recall = recall;
      if (requestedMetrics.includes('f1')) computed.f1Score = f1Score;
    }

    const model = this.modelRegistry?.get(modelName, version);
    const modelVersion = model?.metadata.version ?? version ?? 'unknown';

    const result: EvaluationResult = {
      modelName,
      version: modelVersion,
      metrics: computed,
      evaluatedAt: new Date(),
    };

    this.recordEvaluation(result);
    logger.debug(`Evaluated ${modelName}@${modelVersion}`, computed);

    return result;
  }

  private extractPredictedLabel(prediction: PredictionResult<unknown>, key?: string): string {
    if (key && prediction[key] !== undefined) {
      return String(prediction[key]);
    }
    for (const k of ['label', 'sentiment', 'class', 'prediction']) {
      if (prediction[k] !== undefined) return String(prediction[k]);
    }
    const first = Object.values(prediction)[0];
    return first !== undefined ? String(first) : '';
  }

  private computeAccuracy(labels: string[], predicted: string[]): number {
    let correct = 0;
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] === predicted[i]) correct++;
    }
    return labels.length > 0 ? correct / labels.length : 0;
  }

  private computePrecisionRecallF1(
    labels: string[],
    predicted: string[]
  ): { precision: number; recall: number; f1Score: number } {
    const classes = [...new Set([...labels, ...predicted])].filter(Boolean);
    if (classes.length === 0) return { precision: 0, recall: 0, f1Score: 0 };

    let totalPrecision = 0;
    let totalRecall = 0;
    let count = 0;

    for (const cls of classes) {
      let tp = 0,
        fp = 0,
        fn = 0;
      for (let i = 0; i < labels.length; i++) {
        const isPred = predicted[i] === cls;
        const isActual = labels[i] === cls;
        if (isPred && isActual) tp++;
        if (isPred && !isActual) fp++;
        if (!isPred && isActual) fn++;
      }
      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      totalPrecision += precision;
      totalRecall += recall;
      count++;
    }

    const precision = count > 0 ? totalPrecision / count : 0;
    const recall = count > 0 ? totalRecall / count : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return { precision, recall, f1Score };
  }
}
