# @hazeljs/predictive-scaling

**Scale before the spike. Not after.**

Forecast traffic ~30 minutes ahead, raise Kubernetes HPA `minReplicas` proactively, and boost on business events.

Use [`@hazeljs/self-healing`](https://hazeljs.ai/docs/packages/self-healing) for **reactive** recovery (`hpa-boost` after latency degrades). This package is **proactive**.

[![npm version](https://img.shields.io/npm/v/@hazeljs/predictive-scaling.svg)](https://www.npmjs.com/package/@hazeljs/predictive-scaling)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/predictive-scaling)](https://www.npmjs.com/package/@hazeljs/predictive-scaling)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 📈 **Time-series forecast** - Exponential smoothing + seasonal hour-of-week patterns
- ☸️ **Proactive HPA** - Raise `minReplicas` before predicted spikes
- 💰 **Cost optimization** - Confidence thresholds and gradual scale-down
- 🎉 **Event-driven boosts** - `black-friday`, `product-launch`, custom events
- 🎨 **Decorator API** - `@PredictiveScaling`, `@ScalePredict`, `@ScaleOnEvent`
- 🤖 **Optional AI forecasts** - `createAIForecastProvider()` hook for `@hazeljs/ai`
- 📊 **Prometheus ingest** - Poll real cluster metrics into the forecast
- 🔗 **Self-healing bridge** - `adaptSelfHealingScalingClient()` + `createOperationsStack()`

## Installation

```bash
npm install @hazeljs/predictive-scaling @hazeljs/core
```

### Optional Dependencies

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
  adaptSelfHealingScalingClient,
} from '@hazeljs/predictive-scaling';
import { InMemoryKubernetesScalingClient } from '@hazeljs/self-healing';

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

## Prometheus Ingestion

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

## Combined Ops Stack

Wire this package with `@hazeljs/self-healing`:

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

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)

## Links

- [Documentation](https://hazeljs.ai/docs/packages/predictive-scaling)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.gg/PxNBPzvQk7)
