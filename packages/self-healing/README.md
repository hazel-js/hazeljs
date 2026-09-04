# @hazeljs/self-healing

**Self-healing microservices** for HazelJS — automatic error diagnosis, recovery strategies, config rollback, memory guard, K8s pod restart, and incident notifications.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Overview

**Phase 1** — rule-based diagnosis and recovery primitives (decorators + programmatic API).

**Phase 2** — production integrations:

- **LLM diagnosis** via `@hazeljs/ai` (`aiDiagnostics: true` or `createHazelAIDiagnosticsProvider`)
- **Kubernetes pod restart** (`pod-restart` strategy + rollout patch client)
- **Slack / PagerDuty** healing notifications

**Phase 3** — cluster ops & incident workflow:

- **Graceful drain** before pod restart (`GracefulDrainCoordinator`, `drainBeforeRestart`)
- **HPA boost** (`hpa-boost` strategy) with auto-restore after cooldown
- **Performance-driven scaling** (`recordLatency` + `performance.autoScaleOnDegradation`)
- **Jira incidents** via `createJiraHealingNotifier` (compatible with `@hazeljs/ops-agent`)

## Installation

```bash
npm install @hazeljs/self-healing @hazeljs/core
```

Optional integrations:

```bash
npm install @hazeljs/resilience @hazeljs/ai @hazeljs/ops-agent
```

## Quick Start

### Decorators

```typescript
import {
  SelfHealing,
  SelfHeal,
  MemoryGuard,
  createSlackHealingNotifier,
  InMemoryKubernetesRestartClient,
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

### Programmatic API with AI + K8s

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

## Phase 3: Drain, HPA, Jira

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

## License

Apache-2.0
