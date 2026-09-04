import { PrometheusMetricsCollector, PrometheusQueryConfig } from '../metrics/prometheus-collector';
import { PredictiveScaler } from '../scaling/predictive-scaler';

/**
 * Attach Prometheus polling to a predictive scaler metrics store.
 */
export function attachPrometheusCollector(
  scaler: PredictiveScaler,
  config: PrometheusQueryConfig
): PrometheusMetricsCollector {
  return new PrometheusMetricsCollector(config, (sample) => {
    scaler.recordMetric(sample.metric, sample.value, sample.timestamp);
  });
}
