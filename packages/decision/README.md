# @hazeljs/decision

**Bounded, typed decisions for Agent OS — choose from a closed set, then govern.**

Models propose. Agents evaluate. Critics challenge. Confidence informs. Policies govern. Skillgate classifies. Gatekeeper authorizes. Durable Kernel executes.

This is **not** a wrapper around Jev, OpenAI, Gemini, or another external decision model. The default provider is `hazel-agent`: a native evidence → candidates → judge → critic → confidence pipeline. External providers are optional adapters; every result still passes policy and Gatekeeper.

```
Reasoning ≠ Decision ≠ Policy ≠ Authorization ≠ Execution
```

[![npm version](https://img.shields.io/npm/v/@hazeljs/decision.svg)](https://www.npmjs.com/package/@hazeljs/decision)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/decision)](https://www.npmjs.com/package/@hazeljs/decision)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Closed-set choices** — `choices: [...] as const`; invalid model output is rejected
- **Native `hazel-agent` provider** — evidence / candidates / judge / critic / confidence (optional LLM via `generateObject`)
- **Risk → strategy routing** — `fast` | `standard` | `deliberate` | `human-required` | `rules`
- **Deterministic policy** — allow / critique / review / deny from confidence bands (never authorization)
- **Gatekeeper + Skillgate** — execute only after policy allow **and** Gatekeeper allow; skill class may raise risk floor
- **Durable HITL** — review creates `HumanTask`; resume with receipts (no double-invoke)
- **Decision Lab** — run / shadow compare / flow projection; Agent Office at `/office/decisions`
- **Opt-in extensions** — ensemble, cache, history/trends, calibration, cost-aware router
- **CLI** — `hazel decision run | compare | flow | lab`

## Installation

```bash
npm install @hazeljs/decision @hazeljs/agent
# production execute:
npm install @hazeljs/agent-gatekeeper
# optional:
npm install @hazeljs/skillgate @hazeljs/ai @hazeljs/audit
```

Or:

```bash
hazel add decision
```

## Quick Start

```typescript
import { createDecisionRuntime } from '@hazeljs/decision';

const decisions = createDecisionRuntime();

const result = await decisions.decide({
  objective: 'Choose the safest production remediation',
  state: {
    errorRate: 0.38,
    previousErrorRate: 0.01,
    deploymentAgeMinutes: 4,
    failedHealthChecks: 8,
  },
  choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
  risk: 'high',
  provider: 'hazel-agent',
});

// result.decision: 'retry' | 'rollback' | 'escalate' | 'ignore'
```

Governed runtime (LLM stages + Gatekeeper + audit):

```typescript
import { createGovernedDecisionRuntime } from '@hazeljs/decision';

const decisions = createGovernedDecisionRuntime({
  generateObject: aiService,
  agentRuntime,
  gatekeeper,
  auditService,
});
```

## Architecture

```
decide() → complexity router → provider → confidence → policy
  → Gatekeeper (if execute) → durable checkpoint → capability handler
```

| Concern                  | Primitive                                                   |
| ------------------------ | ----------------------------------------------------------- |
| DNA / HITL / checkpoints | `@hazeljs/agent`                                            |
| Call-time authorization  | `@hazeljs/agent-gatekeeper`                                 |
| Skill risk floor         | `@hazeljs/skillgate`                                        |
| Effect isolation         | Host `effectGate` / `@hazeljs/agent-vm` (not reimplemented) |

**Skillgate** curates skills. **Gatekeeper** authorizes invocations. Confidence never collapses those layers.

## Providers

| Provider                              | Role                                                                 |
| ------------------------------------- | -------------------------------------------------------------------- |
| `hazel-agent`                         | **Default.** Native pipeline; optional `generateObject` judge/critic |
| `mock`                                | `MockDecisionProvider` for tests                                     |
| `auto`                                | Cost-aware router hook                                               |
| `ensemble`                            | Majority / weighted / unanimous / risk-sensitive                     |
| `openai` / `gemini` / `jev` / `local` | Thin adapters — still pass policy + Gatekeeper                       |

```typescript
import {
  createOpenAiDecisionProvider,
  createJevDecisionProvider,
  createEnsembleDecisionProvider,
} from '@hazeljs/decision';

runtime.providers.register(createOpenAiDecisionProvider(aiService));
runtime.providers.register(createJevDecisionProvider({ decide: jevDecide }));
```

On LLM failure, `hazel-agent` falls back to heuristics (never to “allow”).

## Policy → Gatekeeper

Default confidence bands (overridable via DNA / request policy):

| Band           | Policy             |
| -------------- | ------------------ |
| ≥ high (0.95)  | `allow` (eligible) |
| ≥ medium (0.7) | `critique`         |
| &lt; medium    | `review` (HITL)    |

Even with confidence `0.999` and policy `allow`, **Gatekeeper can deny**. Missing Gatekeeper + `execute: true` ⇒ denied.

```typescript
await decisions.resumeFromHuman({
  decisionId,
  runId,
  action: 'override', // approve | reject | override
  decision: 'escalate',
  actor: 'ops-lead',
  reason: 'Rollback currently prohibited',
  execute: true,
});
```

## Decision DNA

Optional on Agent DNA (`format: 'hazeljs.agent.dna'`):

```typescript
decisions: {
  'incident-remediation': {
    version: '3',
    objective: 'Choose the safest remediation',
    choices: ['retry', 'rollback', 'escalate', 'ignore'],
    risk: { level: 'high' },
    confidence: { high: 0.95, medium: 0.7 },
    execution: { rollback: { capability: 'deployment.rollback' } },
  },
}
```

Risk is trusted configuration. Models cannot lower it. Skillgate may raise the floor only.

## Decision Lab

```typescript
import { createDecisionRuntime, createDecisionLab } from '@hazeljs/decision';

const lab = createDecisionLab(createDecisionRuntime());
const run = await lab.run({ objective, state, choices: [...] as const, risk: 'high' });
const cmp = await lab.compare(request, ['hazel-agent', 'mock']);
// cmp.executionForbidden === true
```

## Opt-in extensions

```typescript
import {
  DecisionCache,
  DecisionHistory,
  createCostAwareRouter,
  projectDecisionFlow,
  fitCalibrationFromHistory,
} from '@hazeljs/decision';

const runtime = createDecisionRuntime({
  cache: new DecisionCache({ ttlMs: 30_000 }),
  history: new DecisionHistory(),
});
await runtime.decide({ ..., cache: true });           // opt-in cache
history.trends();                                       // Lab only — never auto-prompted
runtime.setCalibration(fitCalibrationFromHistory(history));
await runtime.decide({ ..., calibrate: true });         // reporting only
projectDecisionFlow({ risk: 'high' });                  // Flow-shaped UI graph
```

## CLI

```bash
hazel decision run --risk high
hazel decision compare --providers hazel-agent,mock
hazel decision flow --risk critical
hazel decision lab
```

## Examples

```bash
npx tsx examples/incident-remediation.ts
npx tsx examples/refund-hitl.ts
npx tsx examples/high-confidence-denied.ts
npx tsx examples/prompt-injection.ts
npx tsx examples/decision-lab.ts
npx tsx examples/flow-and-calibration.ts
npx tsx examples/ensemble.ts
```

## Progressive complexity

1. `decide()`
2. - provider
3. - risk + confidence
4. - critic + policy
5. - Gatekeeper + durable HITL
6. - DNA + Lab + evaluation

## Security

- State is **data** (prompt-injection resistant)
- Closed choices — no invented verbs
- Risk / policy / capabilities are not model-writable
- Replay never re-executes side effects
- History / calibration never auto-inject into prompts
- Confidence never authorizes

## Related

- [Docs: Decision package](https://hazeljs.ai/docs/packages/decision)
- [Docs: Decision Runtime guide](https://hazeljs.ai/docs/guides/decision)
- [@hazeljs/agent](https://hazeljs.ai/docs/packages/agent)
- [@hazeljs/skillgate](https://hazeljs.ai/docs/packages/skillgate)
- [@hazeljs/agent-gatekeeper](https://hazeljs.ai/docs/packages/agent-gatekeeper)
- [@hazeljs/flow](https://hazeljs.ai/docs/packages/flow)

## License

Apache-2.0
