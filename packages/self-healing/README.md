# @hazeljs/self-healing

**Diagnose the failure. Recover automatically.**

Self-healing microservices for HazelJS: error diagnosis, recovery strategies, config rollback, memory guard, Kubernetes pod restart, HPA boost, and incident notifications.

[![npm version](https://img.shields.io/npm/v/@hazeljs/self-healing.svg)](https://www.npmjs.com/package/@hazeljs/self-healing)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/self-healing)](https://www.npmjs.com/package/@hazeljs/self-healing)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 🩺 **Error diagnosis** - Rule-based diagnostics, optional LLM via `@hazeljs/ai`
- ♻️ **Recovery strategies** - Restart, config rollback, memory cleanup, safe-mode
- ☸️ **Kubernetes** - Pod restart with rollout patch client
- 🚪 **Graceful drain** - Finish in-flight work before restart
- 📈 **HPA boost** - Temporarily raise `minReplicas`, restore after cooldown
- ⏱️ **Latency-driven scale** - `recordLatency()` auto-boosts on degradation
- 🔔 **Incident notify** - Slack, PagerDuty, Jira, or a notifier chain
- 🎨 **Decorator API** - `@SelfHealing`, `@SelfHeal`, `@MemoryGuard`

Pair with [`@hazeljs/predictive-scaling`](https://hazeljs.ai/docs/packages/predictive-scaling) for **proactive** HPA (forecast). This package is **reactive** recovery.

## Installation

```bash
npm install @hazeljs/self-healing @hazeljs/core
```

### Optional Dependencies

```bash
npm install @hazeljs/resilience @hazeljs/ai @hazeljs/ops-agent
```

## Quick Start

### 1. Decorate the module

```typescript
import {
  SelfHealing,
  SelfHeal,
  MemoryGuard,
  createSlackHealingNotifier,
} from '@hazeljs/self-healing';

@SelfHealing({
  enabled: true,
  strategies: ['auto-restart', 'config-rollback', 'pod-restart'],
  aiDiagnostics: true, // uses global AIEnhancedService when available
  notifyOn: ['critical-healing', 'auto-rollback', 'healing-failed', 'pod-restart'],
  notifications: createSlackHealingNotifier({ channel: '#incidents' }),
  kubernetes: {
    deployment: process.env.K8S_DEPLOYMENT!,
    namespace: process.env.K8S_NAMESPACE ?? 'default',
    // client: new FetchKubernetesRestartClient(), // in-cluster default
  },
})
export class AppModule {}
```

### 2. Programmatic API

```typescript
import {
  createHealingCoordinator,
  createHazelAIDiagnosticsProvider,
  createPagerDutyHealingNotifier,
  InMemoryKubernetesRestartClient,
} from '@hazeljs/self-healing';
import { AIEnhancedService } from '@hazeljs/ai';

const healing = createHealingCoordinator({
  aiDiagnostics: createHazelAIDiagnosticsProvider(new AIEnhancedService()),
  strategies: ['config-rollback', 'pod-restart', 'safe-mode'],
  notifications: createPagerDutyHealingNotifier({ routingKey: process.env.PAGERDUTY_ROUTING_KEY }),
  kubernetes: {
    deployment: 'payments-api',
    namespace: 'prod',
    client: new InMemoryKubernetesRestartClient(),
  },
});
```

## Strategies

| Strategy          | When used                   | Action                                                      |
| ----------------- | --------------------------- | ----------------------------------------------------------- |
| `auto-restart`    | Dependency / timeout errors | Re-run `onModuleDestroy` + `onModuleInit` lifecycle hooks   |
| `config-rollback` | Config errors               | Restore last config snapshot                                |
| `memory-cleanup`  | Memory pressure             | Call `clearCache()` + `global.gc()` if exposed              |
| `safe-mode`       | Unrecoverable errors        | Invoke named fallback method                                |
| `pod-restart`     | Cluster-level failures      | Drain in-flight work, then PATCH deployment `restartedAt`   |
| `hpa-boost`       | Performance / load spikes   | Temporarily raise HPA `minReplicas`, restore after cooldown |

## Drain, HPA, and Jira

```typescript
import {
  createHealingCoordinator,
  createJiraHealingNotifier,
  createHealingNotifierChain,
  FetchKubernetesScalingClient,
} from '@hazeljs/self-healing';
import { createJiraTool } from '@hazeljs/ops-agent';

const healing = createHealingCoordinator({
  drain: { timeoutMs: 30000 },
  performance: {
    enabled: true,
    autoScaleOnDegradation: true,
    thresholds: { criticalLatencyMs: 2000, sampleSize: 10 },
  },
  strategies: ['hpa-boost', 'pod-restart', 'config-rollback'],
  notifications: createHealingNotifierChain([
    createJiraHealingNotifier({ jira: createJiraTool(), project: 'OPS' }),
  ]),
  kubernetes: {
    deployment: 'payments-api',
    namespace: 'prod',
    drainBeforeRestart: true,
    hpa: {
      name: 'payments-hpa',
      client: new FetchKubernetesScalingClient(),
      boostMinReplicas: 4,
      restoreAfterMs: 300000,
    },
  },
});

// Track latency — auto-boosts HPA when p95 exceeds critical threshold
await healing.recordLatency('PaymentService.charge', durationMs);
```

## AI Diagnostics

```typescript
// Option A: auto-resolve global AIEnhancedService
createHealingCoordinator({ aiDiagnostics: true });

// Option B: explicit Hazel AI bridge
createHealingCoordinator({
  aiDiagnostics: createHazelAIDiagnosticsProvider(aiService, { model: 'gpt-4o-mini' }),
});

// Option C: any LLM client
createHealingCoordinator({
  aiDiagnostics: createAIDiagnosticsProvider({
    complete: async (messages) => myLlm.chat(messages),
  }),
});
```

## Notifications

```typescript
import {
  createSlackHealingNotifier,
  createPagerDutyHealingNotifier,
  createHealingNotifierChain,
} from '@hazeljs/self-healing';

const notifications = createHealingNotifierChain([
  createSlackHealingNotifier({ channel: '#incidents' }), // SLACK_BOT_TOKEN
  createPagerDutyHealingNotifier({}), // PAGERDUTY_ROUTING_KEY
]);
```

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)

## Links

- [Documentation](https://hazeljs.ai/docs/packages/self-healing)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.gg/PxNBPzvQk7)
