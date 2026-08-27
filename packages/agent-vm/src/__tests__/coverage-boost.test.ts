import { AgentRuntime, AgentState, AgentStateManager, type ToolMetadata } from '@hazeljs/agent';
import {
  attachAgentVmFromEnv,
  attachAgentVmStatusFromEnv,
  agentVmBarrierModeFromEnv,
  agentVmEnabledFromEnv,
  formatAgentVmBoot,
  formatAgentVmStatusBoot,
  getBoundAgentVmStatus,
} from '../runtime/attach-agent-vm';
import { EffectGate } from '../gate/effect-gate';
import { EffectJournal } from '../journal/effect-journal';
import { EffectKind } from '../effects/effect-kind';
import { Reversible } from '../effects/effect.decorator';
import { BarrierHandler } from '../speculation/barrier-handler';
import { BranchStateManager } from '../speculation/branch-state';
import { sliceBudgetAcrossBranches, selectBranchesToPrune } from '../speculation/budget-slicer';
import {
  CustomScorer,
  HeuristicScorer,
  LlmJudgeScorer,
  resolveScorer,
} from '../speculation/scorers';
import { InMemoryQuarantineStore } from '../transaction/quarantine-store';
import { InMemoryJournalStore } from '../journal/stores/memory-journal.store';
import type { JournalEntry } from '../journal/journal-entry.types';
import { Atomic, getAtomicMetadata } from '../transaction/atomic.decorator';

describe('scorers', () => {
  it('heuristic scores strings and objects', () => {
    const scorer = new HeuristicScorer();
    expect(scorer.score({ branchId: 'a', output: 'x'.repeat(50) })).toBe(0.5);
    expect(scorer.score({ branchId: 'b', output: { ok: true } })).toBeGreaterThan(0);
    expect(scorer.score({ branchId: 'c', output: undefined })).toBeCloseTo(0.02);
  });

  it('custom and llm-judge scorers clamp / delegate', async () => {
    const custom = new CustomScorer(() => 0.42);
    expect(await custom.score({ branchId: 'a', output: 'x' })).toBe(0.42);

    const judge = new LlmJudgeScorer(() => 2);
    expect(await judge.score({ branchId: 'a', output: 'x' })).toBe(1);
    expect(await new LlmJudgeScorer(() => -1).score({ branchId: 'a', output: 'x' })).toBe(0);
  });

  it('resolveScorer covers named modes and passthrough', () => {
    expect(resolveScorer('heuristic')).toBeInstanceOf(HeuristicScorer);
    expect(resolveScorer(new HeuristicScorer())).toBeInstanceOf(HeuristicScorer);
    expect(resolveScorer('custom', { customFn: () => 1 })).toBeInstanceOf(CustomScorer);
    expect(resolveScorer('llm-judge', { judgeFn: () => 0.5 })).toBeInstanceOf(LlmJudgeScorer);
    expect(() => resolveScorer('custom')).toThrow(/customFn/);
    expect(() => resolveScorer('llm-judge')).toThrow(/judgeFn/);
  });
});

describe('quarantine + journal store branches', () => {
  it('quarantine filters resolved items', () => {
    const store = new InMemoryQuarantineStore();
    const entry: JournalEntry = {
      id: 'e1',
      runId: 'r1',
      agentId: 'a',
      toolName: 't',
      toolPropertyKey: 't',
      input: {},
      output: {},
      effectKind: EffectKind.REVERSIBLE,
      status: 'committed',
      createdAt: new Date(),
    };
    const id = store.add(entry, 'boom', 1);
    expect(store.list()).toHaveLength(1);
    store.resolve(id);
    store.resolve('missing');
    expect(store.list()).toHaveLength(0);
  });

  it('memory journal updateStatus sets compensatedAt and error', () => {
    const store = new InMemoryJournalStore();
    const entry: JournalEntry = {
      id: 'j1',
      runId: 'r1',
      branchId: 'b1',
      agentId: 'a',
      toolName: 'hold',
      toolPropertyKey: 'hold',
      input: {},
      output: {},
      effectKind: EffectKind.REVERSIBLE,
      status: 'committed',
      createdAt: new Date(),
    };
    store.append(entry);
    store.updateStatus('missing', 'compensated');
    store.updateStatus('j1', 'compensated', 'partial');
    expect(store.listByRun('r1')[0].compensatedAt).toBeInstanceOf(Date);
    expect(store.listByRun('r1')[0].error).toBe('partial');
    store.clearBranch('b1');
    expect(store.listByBranch('b1')).toHaveLength(0);
  });
});

describe('budget slicer edge cases', () => {
  it('handles missing parent budget and token-only slices', () => {
    expect(sliceBudgetAcrossBranches(undefined, 2)).toEqual([
      { branchIndex: 0, budget: {} },
      { branchIndex: 1, budget: {} },
    ]);
    expect(sliceBudgetAcrossBranches({ maxCostUsd: 1 }, 0)).toEqual([]);
    const tokenOnly = sliceBudgetAcrossBranches({ maxTokens: 10 }, 2);
    expect(tokenOnly[0].budget.maxTokens).toBe(5);
    expect(tokenOnly[0].budget.maxCostUsd).toBeUndefined();
  });

  it('prune uses default threshold', () => {
    const leader = { branchId: 'a', score: 1 };
    expect(selectBranchesToPrune([leader, { branchId: 'b', score: 0.5 }], leader)).toEqual(['b']);
  });
});

describe('BranchStateManager coverage', () => {
  it('mutates branch-local state and falls through to parent', () => {
    const parent = new AgentStateManager();
    const mgr = new BranchStateManager(parent);
    const ctx = parent.createContext('agent', 'sess', 'hi');
    const branch = mgr.fork(ctx.executionId, 'b1');

    mgr.updateState(branch.executionId, AgentState.THINKING);
    mgr.addStep(branch.executionId, {
      id: 's1',
      agentId: 'agent',
      executionId: branch.executionId,
      stepNumber: 1,
      state: AgentState.THINKING,
      timestamp: new Date(),
    });
    mgr.updateLastStep(branch.executionId, { result: { success: true, output: { ok: true } } });
    mgr.addMessage(branch.executionId, 'assistant', 'hello');
    mgr.setWorkingMemory(branch.executionId, 'k', 1);
    expect(mgr.getWorkingMemory(branch.executionId, 'k')).toBe(1);
    mgr.addRAGContext(branch.executionId, ['doc']);
    expect(mgr.canContinue(branch.executionId, 10)).toBe(true);
    mgr.updateState(branch.executionId, AgentState.COMPLETED);
    expect(mgr.canContinue(branch.executionId, 10)).toBe(false);

    mgr.putContext({ ...branch, metadata: { ...branch.metadata, tagged: true } });
    expect(mgr.getContext(branch.executionId)?.metadata.tagged).toBe(true);
    expect(mgr.getSessionContexts('sess').length).toBeGreaterThanOrEqual(1);

    mgr.updateState(ctx.executionId, AgentState.THINKING);
    mgr.addStep(ctx.executionId, {
      id: 's2',
      agentId: 'agent',
      executionId: ctx.executionId,
      stepNumber: 1,
      state: AgentState.THINKING,
      timestamp: new Date(),
    });
    mgr.addMessage(ctx.executionId, 'user', 'parent');
    mgr.setWorkingMemory(ctx.executionId, 'p', 2);
    expect(mgr.getWorkingMemory(ctx.executionId, 'p')).toBe(2);
    mgr.addRAGContext(ctx.executionId, ['pdoc']);
    expect(mgr.canContinue(ctx.executionId, 100)).toBe(true);

    mgr.discard('b1');
    expect(mgr.getContext('b1')).toBeUndefined();

    expect(() => mgr.fork('missing')).toThrow();
    expect(() => mgr.commit('missing')).toThrow();

    const b2 = mgr.fork(ctx.executionId, 'b2');
    mgr.deleteContext(b2.executionId);
    mgr.deleteContext(ctx.executionId);
    mgr.clear();
  });
});

describe('EffectGate + BarrierHandler modes', () => {
  class ReversibleTool {
    @Reversible({ compensate: 'undo' })
    async hold(_input: Record<string, unknown>) {
      return { ok: true };
    }

    async undo() {
      return { undone: true };
    }
  }

  it('allows reversible tools while speculative and journals after', async () => {
    const journal = new EffectJournal();
    const events: string[] = [];
    const target = ReversibleTool.prototype;
    const tool = {
      name: 'hold',
      propertyKey: 'hold',
      target,
    } as ToolMetadata;

    const gate = new EffectGate({
      journal,
      emit: (e) => events.push(e.type),
      getExecutionContext: () => ({
        runId: 'r1',
        branchId: 'b1',
        agentId: 'a',
        speculative: true,
      }),
    });

    const before = await gate.beforeToolExecute({
      executionId: 'e1',
      agentId: 'a',
      tool,
      input: {},
      branchId: 'b1',
    });
    expect(before.allow).toBe(true);

    await gate.afterToolExecute({
      executionId: 'e1',
      agentId: 'a',
      tool,
      input: {},
      output: { ok: true },
      branchId: 'b1',
    });
    await gate.afterToolExecute({
      executionId: 'e1',
      agentId: 'a',
      tool,
      input: {},
      output: { ok: true },
      deferred: true,
    });
    expect(events).toContain('agent.vm.effect.journaled');
  });

  it('abort barrier mode sets abortSpeculation', async () => {
    const journal = new EffectJournal();
    const execCtx: {
      runId: string;
      branchId: string;
      agentId: string;
      speculative: boolean;
      abortSpeculation?: boolean;
    } = { runId: 'r1', branchId: 'b1', agentId: 'a', speculative: true };
    const gate = new EffectGate({
      journal,
      getExecutionContext: () => execCtx,
      barrierMode: 'abort',
    });
    const tool = { name: 'charge', propertyKey: 'charge', target: {} } as ToolMetadata;
    const decision = await gate.beforeToolExecute({
      executionId: 'e1',
      agentId: 'a',
      tool,
      input: {},
      branchId: 'b1',
    });
    expect(decision.abortSpeculation).toBe(true);
    expect(execCtx.abortSpeculation).toBe(true);
  });

  it('store-buffer barrier defers irreversible tools', async () => {
    const journal = new EffectJournal();
    const handler = new BarrierHandler({
      mode: 'abort',
      enableStoreBuffer: true,
      journal,
      emit: () => undefined,
    });
    const decision = await handler.handleBarrier({
      tool: { name: 'charge', propertyKey: 'charge', target: {} } as ToolMetadata,
      input: { n: 1 },
      execCtx: { runId: 'r', branchId: 'b', agentId: 'a', speculative: true },
      effectKind: EffectKind.IRREVERSIBLE,
      predict: () => ({ predicted: true }),
    });
    expect(decision.defer).toBe(true);
    expect(BarrierHandler.newBranchId()).toEqual(expect.any(String));
  });

  it('drainBranchIntents executes deferred tools', async () => {
    const journal = new EffectJournal();
    await journal.deferIntent({
      branchId: 'b1',
      runId: 'r1',
      toolName: 'charge',
      toolPropertyKey: 'charge',
      agentId: 'a',
      input: { amount: 1 },
    });
    const gate = new EffectGate({ journal });
    const calls: unknown[] = [];
    await gate.drainBranchIntents('b1', async (intent) => {
      calls.push(intent);
      return { ok: true };
    });
    expect(calls).toHaveLength(1);
  });
});

describe('attachAgentVm env helpers', () => {
  function makeRuntime(): AgentRuntime {
    return new AgentRuntime({
      stateManager: new AgentStateManager(),
      enableMetrics: false,
      enableRetry: false,
      enableCircuitBreaker: false,
      enableAgentRuns: false,
    });
  }

  it('parses env flags and formats boot lines', () => {
    expect(agentVmEnabledFromEnv({ AGENT_OS_AGENT_VM: '1' })).toBe(true);
    expect(agentVmEnabledFromEnv({})).toBe(false);
    expect(agentVmBarrierModeFromEnv({ AGENT_OS_AGENT_VM_BARRIER: 'abort' })).toBe('abort');
    expect(agentVmBarrierModeFromEnv({ AGENT_OS_AGENT_VM_BARRIER: 'store-buffer' })).toBe(
      'store-buffer'
    );
    expect(agentVmBarrierModeFromEnv({})).toBe('converge');
    expect(formatAgentVmBoot(undefined)).toBe('Agent VM: off');
    expect(formatAgentVmStatusBoot(undefined)).toBe('Agent VM: off');
  });

  it('attachAgentVmFromEnv is opt-in and binds status', () => {
    const runtime = makeRuntime();
    expect(attachAgentVmFromEnv(runtime, { env: {} })).toBeUndefined();
    const status = attachAgentVmStatusFromEnv(runtime, {
      env: { AGENT_OS_AGENT_VM: '1', AGENT_OS_AGENT_VM_BARRIER: 'abort' },
    });
    expect(status?.enabled).toBe(true);
    expect(status?.barrierMode).toBe('abort');
    expect(getBoundAgentVmStatus(runtime)?.vm).toBe(status?.vm);
    expect(formatAgentVmBoot(status?.vm, { barrierMode: 'abort' })).toMatch(/Agent VM: on/);
  });
});

describe('atomic decorator default metadata', () => {
  class A {
    @Atomic()
    async go() {
      return 1;
    }
  }
  it('stores empty options object', () => {
    expect(getAtomicMetadata(A.prototype, 'go')).toEqual({});
  });
});
