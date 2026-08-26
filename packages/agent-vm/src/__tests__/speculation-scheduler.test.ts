import 'reflect-metadata';
import { AgentStateManager } from '@hazeljs/agent';
import { EffectGate } from '../gate/effect-gate';
import { EffectJournal } from '../journal/effect-journal';
import { createAgentVmRuntime } from '../runtime/create-agent-vm-runtime';
import { BranchStateManager } from '../speculation/branch-state';
import { createTravelAgent, TravelHoldStore } from '../demo/travel-agent.demo';
import type { SpeculationBranchFn } from '../speculation/speculation-scheduler';
import type { ToolMetadata } from '@hazeljs/agent';

describe('SpeculationScheduler', () => {
  it('commits winner and rolls back loser branch holds', async () => {
    const store = new TravelHoldStore();
    const agent = createTravelAgent(store);
    const stateManager = new AgentStateManager();
    const parentCtx = stateManager.createContext('travel-agent', 'sess-1', 'Plan NYC to LON');

    const vm = createAgentVmRuntime({
      stateManager,
      resolveAgentInstance: () => agent,
      resolveTool: (_agentId, key) =>
        ({
          name: key,
          propertyKey: key,
          target: Object.getPrototypeOf(agent) as object,
        }) as ToolMetadata,
    });

    const runId = EffectGate.newRunId();
    const holdTool = {
      name: 'holdSeat',
      propertyKey: 'holdSeat',
      target: Object.getPrototypeOf(agent) as object,
    } as ToolMetadata;

    const flights = ['AA100', 'BA200', 'VS300'];

    const result = await vm.scheduler.speculate(
      runId,
      parentCtx.executionId,
      { branches: 3, scorer: 'heuristic', prune: 'none' },
      (async (branchId: string, branchIndex: number) => {
        const flightId = flights[branchIndex % flights.length];
        const hold = await agent.holdSeat({ flightId });

        await vm.journal.record({
          runId,
          branchId,
          agentId: 'travel-agent',
          tool: holdTool,
          input: { flightId },
          output: hold,
        });

        return { flightId, holdId: hold.holdId, score: 1 - flightId.length / 100 };
      }) as SpeculationBranchFn,
      { agentId: 'travel-agent', sessionId: 'sess-1' }
    );

    expect(result.scores).toHaveLength(3);
    expect(result.rolledBackBranches).toHaveLength(2);

    // Winning hold remains; losers released
    expect(store.holds.size).toBe(1);
    expect(store.released.length).toBe(2);
  });
});

describe('BranchStateManager', () => {
  it('forks and commits without mutating parent until commit', () => {
    const parent = new AgentStateManager();
    const branchMgr = new BranchStateManager(parent);
    const ctx = parent.createContext('a', 's', 'input');
    parent.setWorkingMemory(ctx.executionId, 'key', 'parent');

    const branch = branchMgr.fork(ctx.executionId, 'branch-1');
    branchMgr.setWorkingMemory(branch.executionId, 'key', 'branch');

    expect(parent.getWorkingMemory(ctx.executionId, 'key')).toBe('parent');

    branchMgr.commit('branch-1');
    expect(parent.getWorkingMemory(ctx.executionId, 'key')).toBe('branch');
  });
});

describe('EffectGate barriers', () => {
  it('blocks irreversible tools in speculative branches (converge mode)', async () => {
    const journal = new EffectJournal();
    const execCtx = { runId: 'r1', branchId: 'b1', agentId: 'a', speculative: true };

    const gate = new EffectGate({
      journal,
      getExecutionContext: () => execCtx,
      barrierMode: 'converge',
    });

    const tool = {
      name: 'charge',
      propertyKey: 'chargeCard',
      target: {},
    } as ToolMetadata;

    const decision = await gate.beforeToolExecute({
      executionId: 'e1',
      agentId: 'a',
      tool,
      input: { amount: 100 },
      branchId: 'b1',
    });

    expect(decision.allow).toBe(false);
    expect(decision.barrier).toBe(true);
  });
});
