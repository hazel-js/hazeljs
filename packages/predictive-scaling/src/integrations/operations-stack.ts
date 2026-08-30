import { createHealingCoordinator, HealingCoordinator } from '@hazeljs/self-healing';
import type { SelfHealingModuleOptions } from '@hazeljs/self-healing';
import { attachPrometheusCollector } from './prometheus';
import { adaptSelfHealingScalingClient } from './self-healing';
import { createPredictiveScaler, PredictiveScaler } from '../scaling/predictive-scaler';
import { PrometheusMetricsCollector, PrometheusQueryConfig } from '../metrics/prometheus-collector';
import { PredictiveScalingOptions } from '../types';

export interface OperationsStackOptions {
  healing?: SelfHealingModuleOptions;
  scaling: PredictiveScalingOptions;
  prometheus?: PrometheusQueryConfig;
}

export interface OperationsStack {
  healing: HealingCoordinator;
  scaler: PredictiveScaler;
  prometheus?: PrometheusMetricsCollector;
  start(): void;
  stop(): void;
}

/**
 * Production stack: reactive self-healing + proactive predictive scaling (+ optional Prometheus feed).
 */
export function createOperationsStack(options: OperationsStackOptions): OperationsStack {
  const healing = createHealingCoordinator(options.healing ?? {});

  const scalingClient =
    options.scaling.hpa.client ??
    (options.healing?.kubernetes?.hpa?.client
      ? adaptSelfHealingScalingClient(options.healing.kubernetes.hpa.client)
      : undefined);

  if (!scalingClient) {
    throw new Error(
      'Operations stack requires scaling.hpa.client or healing.kubernetes.hpa.client'
    );
  }

  const scaler = createPredictiveScaler({
    ...options.scaling,
    hpa: {
      ...options.scaling.hpa,
      client: scalingClient,
    },
  });

  const prometheus = options.prometheus
    ? attachPrometheusCollector(scaler, options.prometheus)
    : undefined;

  return {
    healing,
    scaler,
    prometheus,
    start(): void {
      scaler.start();
      prometheus?.start();
    },
    stop(): void {
      scaler.stop();
      prometheus?.stop();
    },
  };
}
