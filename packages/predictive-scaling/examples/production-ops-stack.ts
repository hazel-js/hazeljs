/**
 * Production ops stack — predictive scaling + reactive self-healing.
 *
 * Demonstrates:
 * - Proactive HPA boost from forecasted traffic (predictive-scaling)
 * - Reactive recovery on failures (self-healing)
 * - Optional Prometheus metric ingestion
 */
import {
  createHealingCoordinator,
  createSlackHealingNotifier,
  createHealingNotifierChain,
  InMemoryKubernetesRestartClient,
  InMemoryKubernetesScalingClient,
} from '@hazeljs/self-healing';
import {
  createPredictiveScaler,
  attachPrometheusCollector,
  createOperationsStack,
} from '@hazeljs/predictive-scaling';

export function createProductionOpsStack(env: {
  hpaName: string;
  deployment: string;
  namespace?: string;
  prometheusUrl?: string;
}) {
  const scalingClient = new InMemoryKubernetesScalingClient();
  const restartClient = new InMemoryKubernetesRestartClient();

  return createOperationsStack({
    healing: {
      strategies: ['config-rollback', 'hpa-boost', 'pod-restart', 'safe-mode'],
      aiDiagnostics: true,
      drain: { timeoutMs: 30_000 },
      notifyOn: ['critical-healing', 'healing-failed', 'hpa-boost', 'pod-restart'],
      notifications: createHealingNotifierChain([
        createSlackHealingNotifier({ channel: '#ops-alerts' }),
      ]),
      kubernetes: {
        deployment: env.deployment,
        namespace: env.namespace ?? 'prod',
        client: restartClient,
        drainBeforeRestart: true,
        hpa: {
          name: env.hpaName,
          namespace: env.namespace ?? 'prod',
          client: scalingClient,
          boostMinReplicas: 6,
          restoreAfterMs: 300_000,
        },
      },
      performance: {
        enabled: true,
        autoScaleOnDegradation: true,
        thresholds: { criticalLatencyMs: 2000, sampleSize: 20 },
      },
    },
    scaling: {
      model: 'time-series-forecast',
      metrics: ['requests', 'latency', 'cpu'],
      horizon: '30m',
      confidence: 0.85,
      capacityPerReplica: 120,
      hpa: {
        name: env.hpaName,
        namespace: env.namespace ?? 'prod',
        client: scalingClient,
        maxReplicas: 50,
      },
    },
    prometheus: env.prometheusUrl
      ? {
          baseUrl: env.prometheusUrl,
          pollIntervalMs: 60_000,
          queries: {
            requests: 'sum(rate(http_requests_total{service="' + env.deployment + '"}[5m]))',
            latency:
              'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="' +
              env.deployment +
              '"}[5m])) by (le))',
            cpu:
              'avg(rate(container_cpu_usage_seconds_total{pod=~"' + env.deployment + '.*"}[5m]))',
          },
        }
      : undefined,
  });
}

/** Standalone wiring without createOperationsStack (educational). */
export function createStandaloneWiring() {
  const scalingClient = new InMemoryKubernetesScalingClient();

  const healing = createHealingCoordinator({
    kubernetes: {
      deployment: 'payments-api',
      hpa: { name: 'payments-hpa', client: scalingClient, boostMinReplicas: 4 },
    },
  });

  const scaler = createPredictiveScaler({
    horizon: '30m',
    hpa: { name: 'payments-hpa', client: scalingClient },
  });

  const prometheus = attachPrometheusCollector(scaler, {
    baseUrl: process.env.PROMETHEUS_URL ?? 'http://localhost:9090',
    queries: {
      requests: 'sum(rate(http_requests_total[5m]))',
      latency:
        'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
    },
  });

  return { healing, scaler, prometheus };
}
