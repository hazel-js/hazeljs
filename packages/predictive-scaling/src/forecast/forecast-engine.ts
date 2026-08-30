import { ForecastModel, ForecastResult, MetricName, MetricSample } from '../types';

/**
 * Holt's linear exponential smoothing for short-horizon demand forecasting.
 */
export function forecastExponentialSmoothing(
  metric: MetricName,
  samples: MetricSample[],
  horizonMs: number,
  alpha = 0.35,
  beta = 0.15
): ForecastResult {
  if (samples.length < 2) {
    const latest = samples[samples.length - 1]?.value ?? 0;
    return {
      metric,
      predictedValue: latest,
      confidence: 0.3,
      horizonMs,
      model: 'exponential-smoothing',
      at: Date.now(),
    };
  }

  const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  let level = sorted[0].value;
  let trend = sorted[1].value - sorted[0].value;

  for (let i = 1; i < sorted.length; i++) {
    const value = sorted[i].value;
    const prevLevel = level;
    level = alpha * value + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  const last = sorted[sorted.length - 1];
  const dt = Math.max(1, last.timestamp - sorted[0].timestamp);
  const steps = Math.max(1, horizonMs / (dt / Math.max(1, sorted.length - 1)));
  const predictedValue = Math.max(0, level + trend * steps);

  const residuals = sorted.slice(1).map((sample) => {
    const expected = level;
    return Math.abs(sample.value - expected);
  });
  const avgResidual =
    residuals.length === 0
      ? 0
      : residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
  const confidence = clampConfidence(1 - avgResidual / Math.max(1, level));

  return {
    metric,
    predictedValue,
    confidence,
    horizonMs,
    model: 'exponential-smoothing',
    at: Date.now(),
  };
}

/**
 * Hour-of-week seasonal multiplier based on historical samples.
 */
export function forecastSeasonalPattern(
  metric: MetricName,
  samples: MetricSample[],
  horizonMs: number
): ForecastResult {
  const now = Date.now();
  const targetTime = now + horizonMs;
  const targetHour = new Date(targetTime).getUTCHours();
  const targetDow = new Date(targetTime).getUTCDay();

  const buckets = new Map<string, number[]>();
  for (const sample of samples) {
    const date = new Date(sample.timestamp);
    const key = `${date.getUTCDay()}-${date.getUTCHours()}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(sample.value);
    buckets.set(key, bucket);
  }

  const key = `${targetDow}-${targetHour}`;
  const bucketValues = buckets.get(key) ?? samples.map((sample) => sample.value);
  const predictedValue =
    bucketValues.reduce((sum, value) => sum + value, 0) / Math.max(1, bucketValues.length);

  const globalAvg =
    samples.reduce((sum, sample) => sum + sample.value, 0) / Math.max(1, samples.length);
  const confidence = clampConfidence(bucketValues.length / Math.max(3, samples.length / 24));

  return {
    metric,
    predictedValue: predictedValue || globalAvg,
    confidence,
    horizonMs,
    model: 'seasonal-pattern',
    at: Date.now(),
  };
}

function clampConfidence(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function combineForecasts(forecasts: ForecastResult[]): ForecastResult | null {
  if (forecasts.length === 0) {
    return null;
  }

  const totalWeight = forecasts.reduce((sum, forecast) => sum + forecast.confidence, 0) || 1;
  const predictedValue =
    forecasts.reduce((sum, forecast) => sum + forecast.predictedValue * forecast.confidence, 0) /
    totalWeight;
  const confidence =
    forecasts.reduce((sum, forecast) => sum + forecast.confidence, 0) / forecasts.length;

  return {
    ...forecasts[0],
    predictedValue,
    confidence,
    model: 'time-series-forecast',
  };
}

export function runForecastModel(
  model: ForecastModel,
  metric: MetricName,
  samples: MetricSample[],
  horizonMs: number
): ForecastResult {
  switch (model) {
    case 'seasonal-pattern':
      return forecastSeasonalPattern(metric, samples, horizonMs);
    case 'time-series-forecast':
      return (
        combineForecasts([
          forecastExponentialSmoothing(metric, samples, horizonMs),
          forecastSeasonalPattern(metric, samples, horizonMs),
        ]) ?? forecastExponentialSmoothing(metric, samples, horizonMs)
      );
    case 'exponential-smoothing':
    case 'ai':
    default:
      return forecastExponentialSmoothing(metric, samples, horizonMs);
  }
}
