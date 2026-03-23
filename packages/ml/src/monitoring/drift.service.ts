/**
 * Drift Service - Statistical drift detection for ML model monitoring
 */

import { Service } from '@hazeljs/core';
import logger from '@hazeljs/core';
import type { DriftConfig, DriftResult, DriftReport, DistributionStats } from './drift.types';

@Service()
export class DriftService {
  private referenceDistributions: Map<string, number[]> = new Map();

  /**
   * Set reference distribution for a feature from training data
   */
  setReferenceDistribution(featureName: string, values: number[]): void {
    this.referenceDistributions.set(featureName, [...values]);
    logger.debug(`Set reference distribution for ${featureName} (${values.length} samples)`);
  }

  /**
   * Calculate distribution statistics
   */
  calculateStats(values: number[]): DistributionStats {
    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const mean = values.reduce((a, b) => a + b, 0) / count;

    // Median
    const mid = Math.floor(count / 2);
    const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    // Standard deviation
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / count;
    const std = Math.sqrt(variance);

    // Histogram (10 bins)
    const binWidth = (max - min) / 10 || 1;
    const histogram: Array<{ bin: number; count: number }> = [];
    for (let i = 0; i < 10; i++) {
      const binMin = min + i * binWidth;
      const binMax = binMin + binWidth;
      const binCount = sorted.filter((v) => v >= binMin && v < binMax).length;
      histogram.push({ bin: i, count: binCount });
    }

    // Percentiles
    const percentiles: Record<string, number> = {};
    for (const p of [5, 25, 50, 75, 95]) {
      const idx = Math.floor((count * p) / 100);
      percentiles[`p${p}`] = sorted[Math.min(idx, count - 1)];
    }

    return { count, min, max, mean, median, std, histogram, percentiles };
  }

  /**
   * Population Stability Index (PSI) - measures shift between two distributions
   * PSI < 0.1: no significant shift
   * PSI 0.1-0.25: moderate shift
   * PSI > 0.25: significant shift
   */
  calculatePSI(reference: number[], current: number[], bins = 10): number {
    const refStats = this.calculateStats(reference);
    const currStats = this.calculateStats(current);

    const min = Math.min(refStats.min, currStats.min);
    const max = Math.max(refStats.max, currStats.max);
    const binWidth = (max - min) / bins || 1;

    let psi = 0;

    for (let i = 0; i < bins; i++) {
      const binMin = min + i * binWidth;
      const binMax = binMin + binWidth;

      const refCount = reference.filter((v) => v >= binMin && v < binMax).length;
      const currCount = current.filter((v) => v >= binMin && v < binMax).length;

      const refPct = refCount / reference.length;
      const currPct = currCount / current.length;

      // Avoid division by zero
      if (refPct > 0 && currPct > 0) {
        psi += (currPct - refPct) * Math.log(currPct / refPct);
      }
    }

    return psi;
  }

  /**
   * Kolmogorov-Smirnov test statistic
   * Measures maximum distance between two cumulative distributions
   * Returns D statistic (0-1) and approximate p-value
   */
  calculateKS(reference: number[], current: number[]): { d: number; pValue: number } {
    const sortedRef = [...reference].sort((a, b) => a - b);
    const sortedCurr = [...current].sort((a, b) => a - b);

    const allValues = Array.from(new Set([...sortedRef, ...sortedCurr])).sort((a, b) => a - b);

    let maxDiff = 0;
    for (const value of allValues) {
      const refCdf = sortedRef.filter((v) => v <= value).length / sortedRef.length;
      const currCdf = sortedCurr.filter((v) => v <= value).length / sortedCurr.length;
      const diff = Math.abs(refCdf - currCdf);
      if (diff > maxDiff) maxDiff = diff;
    }

    // Approximate p-value using Kolmogorov distribution
    const n1 = sortedRef.length;
    const n2 = sortedCurr.length;
    const n = (n1 * n2) / (n1 + n2);
    const lambda = (Math.sqrt(n) + 0.12 + 0.11 / Math.sqrt(n)) * maxDiff;

    // Kolmogorov distribution approximation
    const pValue = Math.max(0, 1 - Math.exp(-2 * lambda * lambda));

    return { d: maxDiff, pValue };
  }

  /**
   * Jensen-Shannon Divergence - symmetric version of KL divergence
   * Range: 0 (identical) to ln(2) ≈ 0.693 (maximally different)
   */
  calculateJSD(reference: number[], current: number[], bins = 10): number {
    const refStats = this.calculateStats(reference);
    const currStats = this.calculateStats(current);

    const min = Math.min(refStats.min, currStats.min);
    const max = Math.max(refStats.max, currStats.max);
    const binWidth = (max - min) / bins || 1;

    let jsd = 0;

    for (let i = 0; i < bins; i++) {
      const binMin = min + i * binWidth;
      const binMax = binMin + binWidth;

      const refCount = reference.filter((v) => v >= binMin && v < binMax).length;
      const currCount = current.filter((v) => v >= binMin && v < binMax).length;

      const refP = refCount / reference.length;
      const currP = currCount / current.length;
      const avgP = (refP + currP) / 2;

      // KL divergence terms
      if (refP > 0 && avgP > 0) {
        jsd += refP * Math.log(refP / avgP) * 0.5;
      }
      if (currP > 0 && avgP > 0) {
        jsd += currP * Math.log(currP / avgP) * 0.5;
      }
    }

    return jsd;
  }

  /**
   * Chi-square test for categorical features
   */
  calculateChiSquare(
    reference: Record<string, number>,
    current: Record<string, number>
  ): { chi2: number; pValue: number } {
    const allCategories = new Set([...Object.keys(reference), ...Object.keys(current)]);

    const refTotal = Object.values(reference).reduce((a, b) => a + b, 0);
    const currTotal = Object.values(current).reduce((a, b) => a + b, 0);

    let chi2 = 0;
    let df = 0; // degrees of freedom

    for (const category of allCategories) {
      const refCount = reference[category] ?? 0;
      const currCount = current[category] ?? 0;

      const expectedRef = (refCount + currCount) * (refTotal / (refTotal + currTotal));
      const expectedCurr = (refCount + currCount) * (currTotal / (refTotal + currTotal));

      if (expectedRef > 0) {
        chi2 += Math.pow(refCount - expectedRef, 2) / expectedRef;
        df++;
      }
      if (expectedCurr > 0) {
        chi2 += Math.pow(currCount - expectedCurr, 2) / expectedCurr;
        df++;
      }
    }

    df = Math.max(1, df - 1);

    // Approximate p-value using chi-square CDF approximation
    const pValue = this.chiSquarePValue(chi2, df);

    return { chi2, pValue };
  }

  /**
   * Wasserstein distance (Earth Mover's Distance)
   * Measures how much "work" is needed to transform one distribution into another
   */
  calculateWasserstein(reference: number[], current: number[]): number {
    const sortedRef = [...reference].sort((a, b) => a - b);
    const sortedCurr = [...current].sort((a, b) => a - b);

    const n = Math.min(sortedRef.length, sortedCurr.length);
    let distance = 0;

    for (let i = 0; i < n; i++) {
      distance += Math.abs(sortedRef[i] - sortedCurr[i]);
    }

    return distance / n;
  }

  /**
   * Detect drift for numeric features
   */
  detectDrift(
    featureName: string,
    currentValues: number[],
    config: Omit<DriftConfig, 'features' | 'type'>
  ): DriftResult {
    const referenceValues = this.referenceDistributions.get(featureName);
    if (!referenceValues) {
      throw new Error(`No reference distribution set for feature: ${featureName}`);
    }

    let score = 0;
    let pValue: number | undefined;
    let driftDetected = false;

    switch (config.method) {
      case 'psi': {
        score = this.calculatePSI(referenceValues, currentValues);
        driftDetected = score > config.threshold;
        break;
      }
      case 'ks': {
        const result = this.calculateKS(referenceValues, currentValues);
        score = result.d;
        pValue = result.pValue;
        driftDetected = result.d > config.threshold || result.pValue < 0.05;
        break;
      }
      case 'jsd': {
        score = this.calculateJSD(referenceValues, currentValues);
        driftDetected = score > config.threshold;
        break;
      }
      case 'wasserstein': {
        score = this.calculateWasserstein(referenceValues, currentValues);
        // Normalize by standard deviation
        const refStats = this.calculateStats(referenceValues);
        score = refStats.std > 0 ? score / refStats.std : score;
        driftDetected = score > config.threshold;
        break;
      }
      default:
        throw new Error(`Unsupported drift detection method: ${config.method}`);
    }

    const message = driftDetected
      ? `Drift detected in ${featureName}: ${config.method}=${score.toFixed(4)} exceeds threshold ${config.threshold}`
      : `No drift detected in ${featureName}: ${config.method}=${score.toFixed(4)}`;

    return {
      feature: featureName,
      driftDetected,
      score,
      threshold: config.threshold,
      method: config.method,
      pValue,
      message,
      timestamp: new Date(),
    };
  }

  /**
   * Detect drift for categorical features
   */
  detectCategoricalDrift(
    featureName: string,
    currentValues: string[],
    config: Omit<DriftConfig, 'features' | 'type' | 'method'>
  ): DriftResult {
    // Count frequencies
    const referenceValues = this.referenceDistributions.get(featureName);
    if (!referenceValues) {
      throw new Error(`No reference distribution set for feature: ${featureName}`);
    }

    const refCounts = this.countCategories(referenceValues as unknown as string[]);
    const currCounts = this.countCategories(currentValues);

    const { chi2, pValue } = this.calculateChiSquare(refCounts, currCounts);

    // Normalize chi2 score
    const score = chi2 / Math.max(1, Object.keys(refCounts).length);
    const driftDetected = pValue < 0.05 || score > config.threshold;

    return {
      feature: featureName,
      driftDetected,
      score,
      threshold: config.threshold,
      method: 'chi2',
      pValue,
      message: driftDetected
        ? `Drift detected in ${featureName}: chi2=${score.toFixed(4)}, p=${pValue?.toFixed(4)}`
        : `No drift detected in ${featureName}: chi2=${score.toFixed(4)}`,
      timestamp: new Date(),
    };
  }

  /**
   * Run full drift detection report on multiple features
   */
  detectDriftReport(
    features: Record<string, number[]>,
    config: Pick<DriftConfig, 'method' | 'threshold' | 'windowSize'>
  ): DriftReport {
    const results: DriftResult[] = [];

    for (const [name, values] of Object.entries(features)) {
      try {
        const result = this.detectDrift(name, values, config);
        results.push(result);
      } catch (error) {
        logger.warn(`Failed to detect drift for ${name}:`, error);
      }
    }

    const driftedFeatures = results.filter((r) => r.driftDetected).length;
    const totalFeatures = results.length;
    const driftPercentage = totalFeatures > 0 ? (driftedFeatures / totalFeatures) * 100 : 0;

    return {
      timestamp: new Date(),
      totalFeatures,
      driftedFeatures,
      driftPercentage,
      results,
      overallDrift: driftPercentage > 25, // Overall drift if >25% of features drifted
    };
  }

  /**
   * Detect prediction drift (monitor model output distribution)
   */
  detectPredictionDrift(
    referencePredictions: number[] | string[],
    currentPredictions: number[] | string[]
  ): DriftResult {
    // For numeric predictions (regression)
    if (typeof referencePredictions[0] === 'number') {
      this.setReferenceDistribution('__prediction__', referencePredictions as number[]);
      return this.detectDrift('__prediction__', currentPredictions as number[], {
        method: 'ks',
        threshold: 0.1,
      });
    }

    // For categorical predictions (classification)
    const refCounts = this.countCategories(referencePredictions as string[]);
    const currCounts = this.countCategories(currentPredictions as string[]);
    const { chi2, pValue } = this.calculateChiSquare(refCounts, currCounts);

    const score = chi2 / Math.max(1, Object.keys(refCounts).length);
    const driftDetected = pValue < 0.05;

    return {
      feature: 'prediction',
      driftDetected,
      score,
      threshold: 0.05,
      method: 'chi2',
      pValue,
      message: driftDetected
        ? `Prediction drift detected: chi2=${score.toFixed(4)}, p=${pValue?.toFixed(4)}`
        : `No prediction drift detected: chi2=${score.toFixed(4)}`,
      timestamp: new Date(),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private countCategories(values: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const value of values) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
  }

  private chiSquarePValue(chi2: number, df: number): number {
    // Wilson-Hilferty approximation for chi-square CDF
    if (chi2 <= 0) return 1;
    if (df <= 0) return 1;

    const z = Math.sqrt(2 * chi2) - Math.sqrt(2 * df - 1);
    // Standard normal CDF approximation
    return 1 - this.normalCDF(z);
  }

  private normalCDF(x: number): number {
    // Abramowitz and Stegun approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.sqrt(2);

    const t = 1 / (1 + p * absX);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

    return 0.5 * (1 + sign * y);
  }
}
