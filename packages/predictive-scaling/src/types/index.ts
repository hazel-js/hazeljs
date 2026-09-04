/**
 * Types for @hazeljs/predictive-scaling
 */

export type MetricName = 'cpu' | 'memory' | 'requests' | 'latency' | string;

export type ForecastModel =
  | 'exponential-smoothing'
  | 'seasonal-pattern'
  | 'ai'
  | 'time-series-forecast';

export interface MetricSample {
  metric: MetricName;
  value: number;
  timestamp: number;
}

export interface ForecastResult {
  metric: MetricName;
  predictedValue: number;
  confidence: number;
  horizonMs: number;
  model: ForecastModel;
  at: number;
}

export interface KubernetesScalingClient {
  getHpaMinReplicas(hpa: string, namespace: string): Promise<number>;
  setHpaMinReplicas(hpa: string, namespace: string, minReplicas: number): Promise<void>;
}

export interface HpaTargetConfig {
  name: string;
  namespace?: string;
  client: KubernetesScalingClient;
  maxReplicas?: number;
  minReplicasFloor?: number;
}

export interface ScaleUpPolicy {
  before?: string | number;
  factor?: number;
}

export interface ScaleDownPolicy {
  after?: string | number;
  gradual?: boolean;
}

export interface PredictiveScalingOptions {
  model?: ForecastModel;
  metrics?: MetricName[];
  horizon?: string | number;
  confidence?: number;
  costOptimization?: boolean;
  pollIntervalMs?: number;
  capacityPerReplica?: number;
  hpa: HpaTargetConfig;
  onScale?: (event: ScalingEvent) => void;
  forecastProvider?: ForecastProvider;
}

export interface ScalePredictOptions {
  triggers?: string[];
  scaleUp?: ScaleUpPolicy;
  scaleDown?: ScaleDownPolicy;
  name?: string;
}

export interface ScaleOnEventOptions {
  events: string[];
  prediction?: 'historical-pattern' | 'manual';
  maxScale?: number;
  scaleFactor?: number;
}

export interface ScalingEvent {
  type: 'scale-up' | 'scale-down' | 'no-op' | 'event-boost';
  fromReplicas: number;
  toReplicas: number;
  reason: string;
  forecast?: ForecastResult;
  event?: string;
}

export interface ScalingDecision {
  action: 'scale-up' | 'scale-down' | 'hold';
  targetReplicas: number;
  reason: string;
  confidence: number;
  forecast?: ForecastResult;
}

export interface ForecastProvider {
  forecast(
    metric: MetricName,
    samples: MetricSample[],
    horizonMs: number
  ): Promise<ForecastResult | null>;
}

export interface CostOptimizationOptions {
  enabled?: boolean;
  minConfidence?: number;
  scaleUpHeadroom?: number;
  maxScaleDownPerCycle?: number;
}
