# @hazeljs/predictive-scaling

**Predictive auto-scaling** for HazelJS — forecast traffic 30 minutes ahead, proactively adjust Kubernetes HPA, and scale on business events.

## Features

- **Time-series forecasting** — exponential smoothing + seasonal hour-of-week patterns
- **Proactive HPA scaling** — raises `minReplicas` before predicted spikes
- **Cost optimization** — confidence thresholds, gradual scale-down
- **Event-driven boosts** — `black-friday`, `product-launch`, custom events
- **Decorators** — `@PredictiveScaling`, `@ScalePredict`, `@ScaleOnEvent`
- **Optional AI forecasts** — `createAIForecastProvider()` hook for `@hazeljs/ai`
- **Self-healing bridge** — `adaptSelfHealingScalingClient()` from `@hazeljs/self-healing`

## Installation

```bash
npm install @hazeljs/predictive-scaling @hazeljs/core
```

Optional:

```bash
npm install @hazeljs/self-healing @hazeljs/ai
```

## Quick Start

```typescript
import {
  PredictiveScaling,
  ScalePredict,
  ScaleOnEvent,
  createPredictiveScaler,
  InMemoryScalingClient,
} from '@hazeljs/predictive-scaling';
import { InMemoryKubernetesScalingClient } from '@hazeljs/self-healing';
import { adaptSelfHealingScalingClient } from '@hazeljs/predictive-scaling';

@PredictiveScaling({
  model: 'time-series-forecast',
  metrics: ['requests', 'latency'],
  horizon: '30m',
  confidence: 0.85,
  costOptimization: true,
  hpa: {
    name: 'video-hpa',
    namespace: 'prod',
    client: adaptSelfHealingScalingClient(new InMemoryKubernetesScalingClient()),
    maxReplicas: 100,
  },
})
@ScaleOnEvent({
  events: ['product-launch', 'black-friday'],
  maxScale: 100,
  scaleFactor: 2,
})
export class AppModule {}

export class VideoStreamingService {
  @ScalePredict({
    triggers: ['weekend-pattern', 'viral-content'],
    scaleUp: { before: '15m', factor: 2 },
  })
  async streamVideo() {
    // Demand signals recorded automatically
  }
}
```

## Programmatic API

```typescript
const scaler = createPredictiveScaler({
  horizon: '30m',
  metrics: ['requests'],
  hpa: { name: 'api-hpa', namespace: 'prod', client: new InMemoryScalingClient() },
});

scaler.recordMetric('requests', 420);
scaler.start(); // poll + forecast + apply every 60s

await scaler.triggerEvent('black-friday');
```

## Prometheus ingestion

Feed real cluster metrics into forecasts:

```typescript
import { createPredictiveScaler, attachPrometheusCollector } from '@hazeljs/predictive-scaling';

const scaler = createPredictiveScaler({
  metrics: ['requests', 'latency', 'cpu'],
  hpa: { name: 'api-hpa', namespace: 'prod', client },
});

const prometheus = attachPrometheusCollector(scaler, {
  baseUrl: process.env.PROMETHEUS_URL ?? 'http://localhost:9090',
  pollIntervalMs: 60_000,
  queries: {
    requests: 'sum(rate(http_requests_total{service="api"}[5m]))',
    latency:
      'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="api"}[5m])) by (le))',
    cpu: 'avg(rate(container_cpu_usage_seconds_total{pod=~"api-.*"}[5m]))',
  },
});

scaler.start();
prometheus.start();
```

## Combined ops stack (with `@hazeljs/self-healing`)

```typescript
import { createOperationsStack } from '@hazeljs/predictive-scaling';
import { InMemoryKubernetesScalingClient } from '@hazeljs/self-healing';

const client = new InMemoryKubernetesScalingClient();

const ops = createOperationsStack({
  healing: {
    strategies: ['hpa-boost', 'pod-restart', 'config-rollback'],
    kubernetes: { deployment: 'payments-api', hpa: { name: 'payments-hpa', client } },
  },
  scaling: {
    horizon: '30m',
    metrics: ['requests', 'latency'],
    hpa: { name: 'payments-hpa', client },
  },
  prometheus: {
    baseUrl: 'http://prometheus.monitoring:9090',
    queries: { requests: 'sum(rate(http_requests_total[5m]))' },
  },
});

ops.start();
```

See `examples/production-ops-stack.ts` for a full production wiring template.

## License

Apache-2.0
