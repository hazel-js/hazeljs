import { MetricName, MetricSample } from '../types';

/**
 * Ring-buffer time series store per metric.
 */
export class MetricsStore {
  private readonly series = new Map<MetricName, MetricSample[]>();

  constructor(private readonly maxSamples = 500) {}

  record(metric: MetricName, value: number, timestamp = Date.now()): MetricSample {
    const sample: MetricSample = { metric, value, timestamp };
    const history = this.series.get(metric) ?? [];
    history.push(sample);

    if (history.length > this.maxSamples) {
      history.shift();
    }

    this.series.set(metric, history);
    return sample;
  }

  getSamples(metric: MetricName): MetricSample[] {
    return [...(this.series.get(metric) ?? [])];
  }

  getLatest(metric: MetricName): MetricSample | undefined {
    const history = this.series.get(metric);
    return history?.[history.length - 1];
  }

  metrics(): MetricName[] {
    return [...this.series.keys()];
  }

  clear(metric?: MetricName): void {
    if (metric) {
      this.series.delete(metric);
      return;
    }
    this.series.clear();
  }
}
