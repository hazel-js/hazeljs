/**
 * @hazeljs/predictive-scaling
 * Predictive auto-scaling for HazelJS microservices
 */

export * from './types';

export { MetricsStore } from './metrics/metrics-store';
export { parseDuration, clamp } from './utils/duration';

export {
  forecastExponentialSmoothing,
  forecastSeasonalPattern,
  combineForecasts,
  runForecastModel,
} from './forecast/forecast-engine';

export {
  ForecastEngine,
  createAIForecastProvider,
  AILlmForecastClient,
} from './forecast/ai-forecast-provider';

export { calculateTargetReplicas, decideScaling } from './scaling/replica-calculator';
export { PredictiveScaler, createPredictiveScaler } from './scaling/predictive-scaler';

export {
  EventScalingRegistry,
  calculateEventBoostReplicas,
  RegisteredScaleEvent,
} from './events/event-scaling-registry';

export {
  PredictiveScaling,
  ScalePredict,
  ScaleOnEvent,
  getPredictiveScaler,
  startPredictiveScaling,
  stopPredictiveScaling,
  emitScalingEvent,
} from './decorators';

export { adaptSelfHealingScalingClient, InMemoryScalingClient } from './integrations/self-healing';

export {
  PrometheusMetricsCollector,
  PrometheusQueryConfig,
  PrometheusQueryResult,
  createPrometheusMetricsCollector,
} from './metrics/prometheus-collector';

export { attachPrometheusCollector } from './integrations/prometheus';

export {
  createOperationsStack,
  OperationsStack,
  OperationsStackOptions,
} from './integrations/operations-stack';
