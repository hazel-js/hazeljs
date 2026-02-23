import { Injectable } from '@hazeljs/core';
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

/**
 * Metrics Service - Model evaluation and metrics
 * Tracks model performance for A/B testing and monitoring
 */
@Injectable()
export class MetricsService {
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
}
