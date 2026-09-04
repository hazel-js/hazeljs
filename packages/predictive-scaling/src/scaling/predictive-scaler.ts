import { MetricsStore } from '../metrics/metrics-store';
import { ForecastEngine } from '../forecast/ai-forecast-provider';
import { decideScaling } from '../scaling/replica-calculator';
import {
  calculateEventBoostReplicas,
  EventScalingRegistry,
} from '../events/event-scaling-registry';
import { MetricName, PredictiveScalingOptions, ScalingDecision, ScalingEvent } from '../types';
import { parseDuration } from '../utils/duration';

/**
 * Orchestrates metric collection, forecasting, and proactive HPA adjustments.
 */
export class PredictiveScaler {
  private readonly store = new MetricsStore();
  private readonly forecastEngine: ForecastEngine;
  private readonly options: Required<
    Pick<
      PredictiveScalingOptions,
      'metrics' | 'confidence' | 'costOptimization' | 'capacityPerReplica' | 'pollIntervalMs'
    >
  > &
    PredictiveScalingOptions;
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastDecision: ScalingDecision | null = null;

  constructor(options: PredictiveScalingOptions) {
    this.options = {
      model: 'time-series-forecast',
      metrics: ['requests'],
      horizon: '30m',
      confidence: 0.85,
      costOptimization: true,
      pollIntervalMs: 60_000,
      capacityPerReplica: 100,
      ...options,
    };

    this.forecastEngine = new ForecastEngine(this.options.model, this.options.forecastProvider);
  }

  recordMetric(metric: MetricName, value: number, timestamp?: number): void {
    this.store.record(metric, value, timestamp);
  }

  getMetricsStore(): MetricsStore {
    return this.store;
  }

  async evaluate(): Promise<ScalingDecision> {
    const horizonMs = parseDuration(this.options.horizon ?? '30m');
    const forecasts = await Promise.all(
      this.options.metrics.map(async (metric) => {
        const samples = this.store.getSamples(metric);
        return this.forecastEngine.forecast(metric, samples, horizonMs);
      })
    );

    const predictedLoad = Math.max(...forecasts.map((forecast) => forecast.predictedValue), 0);
    const confidence =
      forecasts.reduce((sum, forecast) => sum + forecast.confidence, 0) /
      Math.max(1, forecasts.length);
    const primaryForecast = forecasts[0];

    const hpa = this.options.hpa;
    const namespace = hpa.namespace ?? 'default';
    const currentReplicas = await hpa.client.getHpaMinReplicas(hpa.name, namespace);
    const maxReplicas = hpa.maxReplicas ?? 100;
    const minReplicas = hpa.minReplicasFloor ?? 1;

    const decision = decideScaling(
      {
        currentReplicas,
        predictedLoad,
        capacityPerReplica: this.options.capacityPerReplica,
        maxReplicas,
        minReplicas,
        confidence,
        forecast: primaryForecast,
      },
      {
        enabled: this.options.costOptimization,
        minConfidence: this.options.confidence,
      }
    );

    this.lastDecision = decision;
    return decision;
  }

  async applyDecision(decision: ScalingDecision): Promise<ScalingEvent> {
    const hpa = this.options.hpa;
    const namespace = hpa.namespace ?? 'default';
    const currentReplicas = await hpa.client.getHpaMinReplicas(hpa.name, namespace);

    if (decision.action === 'hold' || decision.targetReplicas === currentReplicas) {
      const event: ScalingEvent = {
        type: 'no-op',
        fromReplicas: currentReplicas,
        toReplicas: currentReplicas,
        reason: decision.reason,
        forecast: decision.forecast,
      };
      this.options.onScale?.(event);
      return event;
    }

    await hpa.client.setHpaMinReplicas(hpa.name, namespace, decision.targetReplicas);

    const event: ScalingEvent = {
      type: decision.action,
      fromReplicas: currentReplicas,
      toReplicas: decision.targetReplicas,
      reason: decision.reason,
      forecast: decision.forecast,
    };
    this.options.onScale?.(event);
    return event;
  }

  async runCycle(): Promise<ScalingEvent> {
    const decision = await this.evaluate();
    return this.applyDecision(decision);
  }

  async triggerEvent(eventName: string): Promise<ScalingEvent[]> {
    const matches = EventScalingRegistry.findMatching(eventName);
    const results: ScalingEvent[] = [];

    for (const match of matches) {
      const hpa = this.options.hpa;
      const namespace = hpa.namespace ?? 'default';
      const current = await hpa.client.getHpaMinReplicas(hpa.name, namespace);
      const target = calculateEventBoostReplicas(current, match);

      if (target > current) {
        await hpa.client.setHpaMinReplicas(hpa.name, namespace, target);
      }

      const event: ScalingEvent = {
        type: 'event-boost',
        fromReplicas: current,
        toReplicas: target,
        reason: `Event trigger: ${eventName}`,
        event: eventName,
      };
      this.options.onScale?.(event);
      results.push(event);
    }

    return results;
  }

  start(): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      void this.runCycle();
    }, this.options.pollIntervalMs);

    if (typeof this.interval.unref === 'function') {
      this.interval.unref();
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getLastDecision(): ScalingDecision | null {
    return this.lastDecision;
  }
}

export function createPredictiveScaler(options: PredictiveScalingOptions): PredictiveScaler {
  return new PredictiveScaler(options);
}
