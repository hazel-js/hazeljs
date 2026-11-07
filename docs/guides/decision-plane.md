# Decision Plane quickstart

**Use any harness; enforce one execution policy.**

The Decision Plane (`defineDecision` / `createDecisionPlane`) is an **opt-in** API in `@hazeljs/decision`. It does not replace `DecisionRuntime`.

## Install

```bash
npm install @hazeljs/decision
```

## Define and decide

```ts
import { defineDecision, createDecisionPlane, createRulesPlaneProvider } from '@hazeljs/decision';

const route = defineDecision({
  id: 'support.model-route',
  version: '1',
  answers: ['fast', 'balanced', 'advanced', 'abstain'] as const,
  criteria: {
    fast: 'Routine factual question',
    balanced: 'Ambiguous intent',
    advanced: 'Consequential recommendation',
    abstain: 'Insufficient evidence',
  },
  strategy: { providers: ['rules'], onFailure: 'abstain' },
});

const plane = createDecisionPlane({
  providers: [
    createRulesPlaneProvider({
      rules: [{ answer: 'fast', when: (c) => (c as { routine: boolean }).routine }],
      onNoMatch: 'abstain',
    }),
  ],
});

const result = await plane.decide({
  definition: route,
  context: { routine: true },
  execution: {
    tenantId: 't1',
    actorId: 'a1',
    permissionScope: 'support',
    policyVersion: 'pol-1',
  },
});
```

## Result union

`succeeded | abstained | timed_out | unavailable | invalid`. Unknown answers are never coerced.

## Providers

| Provider           | Status                                             |
| ------------------ | -------------------------------------------------- |
| `rules`            | Available — deterministic                          |
| `structured`       | Available — inject `StructuredObjectGenerator`     |
| `jev`              | Inject-only                                        |
| `openai-decisions` | Unavailable until OpenAI publishes a public schema |

## Caching

Opt-in via `definition.cache`. Keys include tenant, actor, permission scope, definition version, policy version, provider strategy, and input digest. Use `RedisDecisionCacheStore` for multi-instance (`MemoryDecisionCacheStore` for tests). Definitions marked security-critical (e.g. tool-risk, memory-candidate integrations set `cache.enabled: false` / refuse caching) will not cache even if enabled.
