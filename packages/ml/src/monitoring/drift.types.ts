/**
 * @hazeljs/ml - Drift Detection Types
 */

export type DriftType = 'data' | 'prediction' | 'concept';

export interface DriftConfig {
  type: DriftType;
  features: string[];
  method: 'psi' | 'ks' | 'jsd' | 'chi2' | 'wasserstein';
  threshold: number;
  windowSize?: number;
  referenceDistribution?: Record<string, number[]>;
}

export interface DriftResult {
  feature: string;
  driftDetected: boolean;
  score: number;
  threshold: number;
  method: DriftConfig['method'];
  pValue?: number;
  message: string;
  timestamp: Date;
}

export interface DriftReport {
  timestamp: Date;
  totalFeatures: number;
  driftedFeatures: number;
  driftPercentage: number;
  results: DriftResult[];
  overallDrift: boolean;
}

export interface DistributionStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  histogram: Array<{ bin: number; count: number }>;
  percentiles: Record<string, number>;
}
