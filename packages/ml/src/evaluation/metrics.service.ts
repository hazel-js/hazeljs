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
  mae?: number;
  mse?: number;
  rmse?: number;
  r2?: number;
  auc?: number;
  brier?: number;
  ndcg?: number;
  map?: number;
  [key: string]: number | undefined;
}

export interface ConfusionMatrix {
  labels: string[];
  matrix: number[][];
}

export interface EvaluationResult {
  modelName: string;
  version: string;
  metrics: ModelMetrics;
  confusionMatrix?: ConfusionMatrix;
  evaluatedAt: Date;
}

export type EvaluateMetric =
  | 'accuracy'
  | 'f1'
  | 'precision'
  | 'recall'
  | 'mae'
  | 'mse'
  | 'rmse'
  | 'r2'
  | 'auc'
  | 'brier'
  | 'confusion'
  | 'ndcg'
  | 'map';

export interface EvaluateOptions {
  metrics?: EvaluateMetric[];
  labelKey?: string;
  predictionKey?: string;
  version?: string;
  /** For regression: key of predicted numeric value */
  valueKey?: string;
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

  /** Compute regression metrics from actual vs predicted values. */
  computeRegressionMetrics(
    actual: number[],
    predicted: number[]
  ): { mae: number; mse: number; rmse: number; r2: number } {
    const n = actual.length;
    if (n === 0) return { mae: 0, mse: 0, rmse: 0, r2: 0 };
    let abs = 0;
    let sq = 0;
    for (let i = 0; i < n; i++) {
      const e = predicted[i] - actual[i];
      abs += Math.abs(e);
      sq += e * e;
    }
    const mae = abs / n;
    const mse = sq / n;
    const rmse = Math.sqrt(mse);
    const mean = actual.reduce((a, b) => a + b, 0) / n;
    const ssTot = actual.reduce((s, v) => s + (v - mean) ** 2, 0);
    const r2 = ssTot === 0 ? 0 : 1 - sq / ssTot;
    return { mae, mse, rmse, r2 };
  }

  /** Build a confusion matrix. */
  computeConfusionMatrix(labels: string[], predicted: string[]): ConfusionMatrix {
    const classes = [...new Set([...labels, ...predicted])].filter(Boolean).sort();
    const index = new Map(classes.map((c, i) => [c, i]));
    const matrix = classes.map(() => classes.map(() => 0));
    for (let i = 0; i < labels.length; i++) {
      const r = index.get(labels[i]);
      const c = index.get(predicted[i]);
      if (r !== undefined && c !== undefined) matrix[r][c]++;
    }
    return { labels: classes, matrix };
  }

  /**
   * Binary ROC-AUC via Mann–Whitney / trapezoid approximation.
   * @param scores predicted probabilities for the positive class
   * @param labels 0/1 or false/true
   */
  computeROCAuc(scores: number[], labels: number[]): number {
    const pairs = scores.map((s, i) => ({ s, y: labels[i] })).sort((a, b) => b.s - a.s);
    let tp = 0;
    let fp = 0;
    const P = labels.filter((y) => y === 1).length;
    const N = labels.length - P;
    if (P === 0 || N === 0) return 0;
    let prevTpr = 0;
    let prevFpr = 0;
    let auc = 0;
    let i = 0;
    while (i < pairs.length) {
      const threshold = pairs[i].s;
      while (i < pairs.length && pairs[i].s === threshold) {
        if (pairs[i].y === 1) tp++;
        else fp++;
        i++;
      }
      const tpr = tp / P;
      const fpr = fp / N;
      auc += ((fpr - prevFpr) * (tpr + prevTpr)) / 2;
      prevTpr = tpr;
      prevFpr = fpr;
    }
    return auc;
  }

  /** Brier score for binary probabilities. */
  computeBrierScore(probs: number[], labels: number[]): number {
    if (probs.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < probs.length; i++) {
      sum += (probs[i] - labels[i]) ** 2;
    }
    return sum / probs.length;
  }

  /**
   * Normalized Discounted Cumulative Gain at k.
   * @param relevances graded relevance scores in rank order (highest rank first)
   */
  computeNDCG(relevances: number[], k?: number): number {
    const rel = k !== undefined ? relevances.slice(0, k) : relevances;
    if (rel.length === 0) return 0;
    const dcg = rel.reduce((sum, r, i) => sum + r / Math.log2(i + 2), 0);
    const ideal = [...rel].sort((a, b) => b - a);
    const idcg = ideal.reduce((sum, r, i) => sum + r / Math.log2(i + 2), 0);
    return idcg === 0 ? 0 : dcg / idcg;
  }

  /**
   * Mean Average Precision for a set of binary relevance lists (1=relevant).
   * Each list is ranked relevance for one query.
   */
  computeMAP(relevanceLists: number[][]): number {
    if (relevanceLists.length === 0) return 0;
    let sum = 0;
    for (const rels of relevanceLists) {
      let hits = 0;
      let precisionSum = 0;
      for (let i = 0; i < rels.length; i++) {
        if (rels[i] > 0) {
          hits++;
          precisionSum += hits / (i + 1);
        }
      }
      const totalRelevant = rels.filter((r) => r > 0).length;
      sum += totalRelevant === 0 ? 0 : precisionSum / totalRelevant;
    }
    return sum / relevanceLists.length;
  }

  /**
   * Evaluate model on test data by running predictions and computing metrics.
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
      valueKey,
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
    let confusionMatrix: ConfusionMatrix | undefined;

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
    if (requestedMetrics.includes('confusion')) {
      confusionMatrix = this.computeConfusionMatrix(labels, predictedLabels);
    }

    const regressionRequested = (['mae', 'mse', 'rmse', 'r2'] as EvaluateMetric[]).some((m) =>
      requestedMetrics.includes(m)
    );
    if (regressionRequested) {
      const actual = testData.map((s) => Number(s[labelKey]));
      const predicted = predictions.map((p) => {
        if (valueKey && p[valueKey] !== undefined) return Number(p[valueKey]);
        if (p.value !== undefined) return Number(p.value);
        if (p.prediction !== undefined) return Number(p.prediction);
        return Number(Object.values(p)[0]);
      });
      const reg = this.computeRegressionMetrics(actual, predicted);
      if (requestedMetrics.includes('mae')) computed.mae = reg.mae;
      if (requestedMetrics.includes('mse')) computed.mse = reg.mse;
      if (requestedMetrics.includes('rmse')) computed.rmse = reg.rmse;
      if (requestedMetrics.includes('r2')) computed.r2 = reg.r2;
    }

    const model = this.modelRegistry?.get(modelName, version);
    const modelVersion = model?.metadata.version ?? version ?? 'unknown';

    const result: EvaluationResult = {
      modelName,
      version: modelVersion,
      metrics: computed,
      confusionMatrix,
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
