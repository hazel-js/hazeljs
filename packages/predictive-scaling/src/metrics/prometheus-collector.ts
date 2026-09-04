import { MetricName } from '../types';

export interface PrometheusQueryConfig {
  /** Prometheus server base URL, e.g. https://prometheus.example.com */
  baseUrl: string;
  /** PromQL per predictive-scaling metric name */
  queries: Partial<Record<MetricName, string>>;
  pollIntervalMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface PrometheusQueryResult {
  metric: MetricName;
  value: number;
  timestamp: number;
}

interface PrometheusApiResponse {
  status: string;
  data?: {
    result?: Array<{
      value?: [number, string];
    }>;
  };
}

/**
 * Polls Prometheus and ingests scalar query results into a callback.
 */
export class PrometheusMetricsCollector {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: PrometheusQueryConfig,
    private readonly onSample: (sample: PrometheusQueryResult) => void
  ) {}

  async pollOnce(): Promise<PrometheusQueryResult[]> {
    const results: PrometheusQueryResult[] = [];

    for (const [metric, query] of Object.entries(this.config.queries)) {
      if (!query) {
        continue;
      }

      const sample = await this.queryMetric(metric as MetricName, query);
      if (sample) {
        this.onSample(sample);
        results.push(sample);
      }
    }

    return results;
  }

  start(): void {
    if (this.interval) {
      return;
    }

    const pollIntervalMs = this.config.pollIntervalMs ?? 60_000;
    this.interval = setInterval(() => {
      void this.pollOnce();
    }, pollIntervalMs);

    if (typeof this.interval.unref === 'function') {
      this.interval.unref();
    }

    void this.pollOnce();
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async queryMetric(
    metric: MetricName,
    query: string
  ): Promise<PrometheusQueryResult | null> {
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/query?query=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10_000);

    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as PrometheusApiResponse;
      const valueTuple = body.data?.result?.[0]?.value;
      if (!valueTuple) {
        return null;
      }

      const [timestampSeconds, valueText] = valueTuple;
      const value = Number(valueText);
      if (!Number.isFinite(value)) {
        return null;
      }

      return {
        metric,
        value,
        timestamp: Math.floor(timestampSeconds * 1000),
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createPrometheusMetricsCollector(
  config: PrometheusQueryConfig,
  onSample: (sample: PrometheusQueryResult) => void
): PrometheusMetricsCollector {
  return new PrometheusMetricsCollector(config, onSample);
}
