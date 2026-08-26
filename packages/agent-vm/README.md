# @hazeljs/agent-vm

Effect-typed agent execution for HazelJS — transactional runs, reversible tools, and speculative multi-branch execution.

## Effect lattice

| Effect                        | Speculation-safe | Undo                  |
| ----------------------------- | ---------------- | --------------------- |
| `@Pure()`                     | Yes              | N/A                   |
| `@Read()`                     | Yes              | N/A                   |
| `@Reversible({ compensate })` | Yes              | `@Compensate` handler |
| `@Irreversible()`             | No (barrier)     | Never                 |

Tools without an effect decorator default to **irreversible** (safe default).

## Quick start

```typescript
import { Agent, Tool, ToolExecutor, AgentStateManager } from '@hazeljs/agent';
import { Read, Reversible, Compensate, createAgentVmRuntime, EffectKind } from '@hazeljs/agent-vm';

const stateManager = new AgentStateManager();
const vm = createAgentVmRuntime({ stateManager });

const toolExecutor = new ToolExecutor();
toolExecutor.setEffectGate(vm.effectGate);

@Agent({ name: 'ops' })
class OpsAgent {
  @Tool({ name: 'hold', description: 'Hold resource' })
  @Reversible({ compensate: 'hold' })
  async hold(input: { id: string }) {
    return { holdId: `h-${input.id}` };
  }

  @Compensate('hold')
  async releaseHold(effect: EffectRecord<{ holdId: string }>) {
    await releaseResource(effect.output.holdId);
  }
}
```

## Speculative execution

```typescript
import { runTravelSpeculationDemo } from '@hazeljs/agent-vm';

const result = await runTravelSpeculationDemo(3);
// Winner committed; losers rolled back via @Compensate
console.log(result.winnerBranchId, result.rolledBackBranches, result.activeHolds);
```

Or drive speculation yourself:

```typescript
const result = await vm.scheduler.speculate(
  runId,
  parentExecutionId,
  { branches: 3, scorer: 'heuristic', prune: 'score' },
  async (branchId) => {
    // branch-local tool calls via EffectGate
    return planTrip(branchId);
  },
  { agentId: 'travel-agent', parentBudget: { maxCostUsd: 0.05 } }
);
```

## Atomic undo

```typescript
await vm.coordinator.undoRun(runId);
```

Replays `@Compensate` handlers newest-first. Failed compensations land in a quarantine store.

## Integration

### Attach to AgentRuntime (recommended)

```typescript
import {
  attachAgentVm,
  attachAndBindAgentVm,
  attachAgentVmFromEnv,
  attachAgentVmStatusFromEnv,
  formatAgentVmStatusBoot,
  getBoundAgentVm,
} from '@hazeljs/agent-vm';

const vm = attachAgentVm(runtime, { barrierMode: 'converge' });

attachAndBindAgentVm(runtime);
const later = getBoundAgentVm(runtime);
```

Opt-in from env (`AGENT_OS_AGENT_VM=1`, optional `AGENT_OS_AGENT_VM_BARRIER`, `AGENT_OS_AGENT_VM_STORE_BUFFER=1`):

```typescript
const status = attachAgentVmStatusFromEnv(runtime);
console.log(formatAgentVmStatusBoot(status));
```

### Manual

```typescript
const vm = createAgentVmRuntime({ stateManager });
toolExecutor.setEffectGate(vm.effectGate);
```

The gate enforces effect rules and journals reversible tool outputs automatically.

## See also

- [`@hazeljs/agent`](../agent) — Agent runtime, tools, HITL
- [`@hazeljs/saga`](../saga) — Business saga compensation (complementary)
