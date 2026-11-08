# @hazeljs/autonomous

**Governed autonomy for ordinary HazelJS services — observe, decide, approve, execute.**

Models and rules may propose actions. They must not bypass authorization. The Autonomous Application Runtime (AAR) coordinates existing Agent OS primitives so `@Injectable()` services can opt into durable, inspectable autonomy without becoming `@Agent` classes.

```
Observation ≠ Decision ≠ Policy ≠ Authorization ≠ Execution
```

[![npm version](https://img.shields.io/npm/v/@hazeljs/autonomous.svg)](https://www.npmjs.com/package/@hazeljs/autonomous)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/autonomous)](https://www.npmjs.com/package/@hazeljs/autonomous)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Framework-native decorators** — `@Autonomous`, `@Observe`, `@Capability` in `@hazeljs/core` (no AI deps on core)
- **Default deny** — capabilities execute only with explicit grants + Gatekeeper allow
- **Modes** — `disabled` | `observe-only` | `suggest` | `approval-required` | `governed-auto`
- **Deterministic decisions by default** — built-in rules engine; LLM / Decision Plane optional
- **HITL** — approval binding with argument digest; resume revalidates before execute
- **Durable runs** — in-memory for local/tests; optional `@hazeljs/agent` DurableRunStore bridge
- **Loop protection** — depth, cooldown, dedupe, per-run action ceilings
- **Safe replay** — dry-run only; never repeats live side effects
- **Simulation** — `simulate()` with hard live-effect barrier
- **CLI** — `hazel add autonomous`; `hazel agent runs timeline | replay | diff`

## Installation

```bash
npm install @hazeljs/autonomous @hazeljs/core @hazeljs/agent-gatekeeper
# optional production durability:
npm install @hazeljs/agent
# optional:
npm install @hazeljs/decision @hazeljs/agent-vm @hazeljs/event-emitter
```

Or:

```bash
hazel add autonomous --setup
```

Enable `experimentalDecorators` (and typically `emitDecoratorMetadata`) in `tsconfig.json`.

## Quick Start

```typescript
import { Injectable, Autonomous, Observe, Capability, HazelModule } from '@hazeljs/core';
import { AutonomousModule } from '@hazeljs/autonomous';

@Injectable()
@Autonomous({
  id: 'order-operations',
  objective: 'Maintain reliable order processing',
  mode: 'approval-required',
  capabilities: ['orders.retry'],
})
export class OrderOperationsService {
  @Observe('orders.failed')
  onFailure(event: { orderId: string }) {
    return event;
  }

  @Capability({
    id: 'orders.retry',
    effect: 'idempotent',
    approval: 'auto',
    idempotencyKey: true,
  })
  retryOrder(input: { orderId: string }) {
    return { retried: input.orderId };
  }
}

@HazelModule({
  imports: [AutonomousModule.forRoot({ observability: { enabled: true } })],
  providers: [OrderOperationsService],
})
export class AppModule {}
```

Emit and resume:

```typescript
import { AutonomousRuntime } from '@hazeljs/autonomous';

const runtime = container.resolve(AutonomousRuntime);
const [runId] = await runtime.emit('orders.failed', { orderId: 'ORD-1' }, { tenantId: 't1' });
await runtime.resume(runId!, { approved: true, actor: 'ops' });
```

## Modes

| Mode                | Behavior                                               |
| ------------------- | ------------------------------------------------------ |
| `disabled`          | No autonomous execution                                |
| `observe-only`      | Record observations only                               |
| `suggest`           | Recommendations only                                   |
| `approval-required` | HITL before effects                                    |
| `governed-auto`     | Execute only granted + Gatekeeper-allowed capabilities |

There is **no** permission-bypassing mode. “Fully autonomous” marketing language, if used, means governed-auto within policy.

## Architecture

```
@Service @Autonomous
  → @Observe → AutonomousRuntime
    → decision engine (rules / optional Decision Plane)
      → Gatekeeper (authorize)
        → HITL when required
          → capability method
            → durable run + timeline
```

| Concern                 | Primitive                                        |
| ----------------------- | ------------------------------------------------ |
| Decorators / contracts  | `@hazeljs/core`                                  |
| Call-time authorization | `@hazeljs/agent-gatekeeper`                      |
| Durable runs (optional) | `@hazeljs/agent` DurableRunStore                 |
| Effect isolation        | Optional `@hazeljs/agent-vm` (not reimplemented) |
| Advanced decisions      | Optional `@hazeljs/decision`                     |

Decisions **propose**. Gatekeeper **authorizes**. Confidence / model output never collapses those layers.

## Capabilities

```typescript
@Capability({
  id: 'payments.refund',
  effect: 'irreversible',
  approval: 'required',
  reconcile: 'reconcileRefund',
})
async refund(input: RefundInput) {
  return this.payments.refund(input);
}
```

Irreversible capabilities cannot auto-retry without `idempotencyKey` or `reconcile` (`HAZEL_AUTONOMOUS_RETRY_UNSAFE`).

## Local examples

```bash
npm run example:order-ops --workspace=@hazeljs/autonomous
npm run demo:failure --workspace=@hazeljs/autonomous
```

## CLI

```bash
hazel add autonomous --setup
hazel agent runs list
hazel agent runs inspect <run-id>
hazel agent runs timeline <run-id>
hazel agent runs replay <run-id> --dry-run
hazel agent runs diff <run-a> <run-b>
```

## Docs

- Guide: [`hazeljs/docs/guides/autonomous-runtime.md`](../../docs/guides/autonomous-runtime.md)
- Quick start: [`hazeljs/docs/guides/autonomous-quickstart.md`](../../docs/guides/autonomous-quickstart.md)
- Security: [`hazeljs/docs/guides/autonomous-security.md`](../../docs/guides/autonomous-security.md)
- ADRs: [`docs/architecture/autonomous-runtime/`](../../../docs/architecture/autonomous-runtime/)

## Related

- [`@hazeljs/agent`](https://www.npmjs.com/package/@hazeljs/agent) — Agent OS durable kernel
- [`@hazeljs/agent-gatekeeper`](https://www.npmjs.com/package/@hazeljs/agent-gatekeeper) — tool authorization
- [`@hazeljs/decision`](https://www.npmjs.com/package/@hazeljs/decision) — bounded decision runtime
- [`@hazeljs/ai`](https://www.npmjs.com/package/@hazeljs/ai) — lighter `@AgentTool` call contract (not AAR)
