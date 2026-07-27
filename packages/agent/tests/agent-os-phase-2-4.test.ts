import { AgentTimelineRecorder } from '../src/timeline/timeline.recorder';
import { TimeTravelDebugger } from '../src/timetravel/time-travel';
import { AgentEventType } from '../src/types/event.types';
import { PolicyEngine, defaultPiiMaskPolicies } from '../src/policies/policy.engine';
import { validateAgentContract } from '../src/contracts/agent-contract';
import { AgentState } from '../src/types/agent.types';
import { runRecoveryLadder } from '../src/recovery/recovery-ladder';
import { openApiToSkills } from '../src/skills/openapi-skills';
import { AgentMemoryGraph } from '../src/memory-graph/memory-graph';
import { evolveSystemPrompt } from '../src/evolution/agent-evolution';
import { CostOptimizer } from '../src/cost/cost-optimizer';
import { runAgentSimulator } from '../src/simulator/agent-simulator';
import { jaccardSimilarity, runDigitalTwin } from '../src/twin/digital-twin';
import { exportAgentDna, parseDna } from '../src/dna/agent-dna';
import { runConsensus } from '../src/consensus/consensus';
import { GovernanceGate, defaultAgentGovernance } from '../src/governance/governance';
import { compareBenchmarkRuns, summarizeBenchmarkRun } from '../src/benchmark/benchmark';

describe('Agent OS Phase 2–4', () => {
  it('time travel forks, edits, and prepares continue', () => {
    const timeline = new AgentTimelineRecorder();
    timeline.record({
      type: AgentEventType.EXECUTION_STARTED,
      agentId: 'a',
      executionId: 'e1',
      timestamp: new Date(),
      data: { input: 'hello' },
    } as never);
    timeline.record({
      type: AgentEventType.STEP_COMPLETED,
      agentId: 'a',
      executionId: 'e1',
      timestamp: new Date(),
      data: { thought: 'thinking' },
    } as never);

    const tt = new TimeTravelDebugger(timeline);
    const fork = tt.fork('e1');
    expect(fork.steps.length).toBe(2);
    const edited = tt.edit(fork.forkId, {
      stepId: fork.steps[0].id,
      kind: 'prompt',
      value: 'edited hello',
    });
    expect(edited.steps[0].prompt).toBe('edited hello');
    const cont = tt.prepareContinue(fork.forkId, { input: 'continue' });
    expect(cont.input).toBe('continue');
    expect(cont.metadata.timeTravel).toBeDefined();
  });

  it('policy engine denies and masks', () => {
    const engine = new PolicyEngine([
      ...defaultPiiMaskPolicies(),
      { id: 'deny-refund', tool: 'refund', effect: 'deny', reason: 'no refunds', priority: 10 },
    ]);
    const masked = engine.evaluate('lookup', { ssn: '123', orderId: '1' });
    expect(masked.input.ssn).toBe('[REDACTED]');
    expect(masked.allowed).toBe(true);
    const denied = engine.evaluate('refund', { amount: 10 });
    expect(denied.allowed).toBe(false);
  });

  it('validates agent contracts', async () => {
    const result = {
      executionId: 'e',
      agentId: 'a',
      state: AgentState.COMPLETED,
      response: 'Refund processed',
      steps: [],
      metadata: {},
      duration: 100,
      completedAt: new Date(),
    };
    const ok = await validateAgentContract(
      { name: 'refund', outputIncludes: 'refund', maxLatencyMs: 500 },
      'I want a refund',
      result
    );
    expect(ok.ok).toBe(true);
  });

  it('recovery ladder retries then succeeds', async () => {
    let n = 0;
    const out = await runRecoveryLadder({
      execute: async () => {
        n += 1;
        if (n < 2) throw new Error('fail');
        return 'ok';
      },
      ladder: { maxRetries: 3, steps: ['retry', 'fail'] },
    });
    expect(out.success).toBe(true);
    expect(out.result).toBe('ok');
  });

  it('openApiToSkills extracts tools', () => {
    const tools = openApiToSkills({
      servers: [{ url: 'https://api.example.com' }],
      paths: {
        '/orders/{id}': {
          get: {
            operationId: 'getOrder',
            summary: 'Get order',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          },
        },
      },
    });
    expect(tools[0].name).toBe('getOrder');
    expect(tools[0].method).toBe('GET');
  });

  it('memory graph links and searches', () => {
    const g = new AgentMemoryGraph();
    const a = g.upsertNode({ type: 'person', label: 'Ada', attributes: {} });
    const b = g.upsertNode({ type: 'org', label: 'Hazel', attributes: {} });
    g.link({ from: a.id, to: b.id, relation: 'works_at' });
    expect(g.neighbors(a.id)).toHaveLength(1);
    expect(g.search('ada')[0].label).toBe('Ada');
  });

  it('evolves prompts heuristically', async () => {
    const s = await evolveSystemPrompt({
      currentPrompt: 'You are helpful.',
      failures: [{ input: 'refund', output: 'no', expectedHint: 'yes' }],
    });
    expect(s.revisedSystemPrompt).toContain('Lessons');
  });

  it('cost optimizer selects a model', () => {
    const opt = new CostOptimizer();
    const m = opt.selectModel({ qualityBias: 0, maxCostUsd: 1 });
    expect(m.tier).toBe('economy');
  });

  it('simulator reports failures', async () => {
    const report = await runAgentSimulator({
      cases: [{ id: '1', input: 'x' }],
      iterations: 2,
      concurrency: 1,
      run: async () => ({ ok: false, durationMs: 5, error: 'boom' }),
    });
    expect(report.failed).toBe(2);
  });

  it('digital twin compares outputs', async () => {
    expect(jaccardSimilarity('hello world', 'hello world')).toBe(1);
    const { compare } = await runDigitalTwin({
      runPrimary: async () => ({ response: 'hello world', duration: 10 }),
      runTwin: async () => ({ response: 'hello world', duration: 12 }),
    });
    expect(compare.match).toBe(true);
  });

  it('dna export/import roundtrips', () => {
    const dna = exportAgentDna({ name: 'support', systemPrompt: 'hi', tools: [{ name: 't' }] });
    const parsed = parseDna(JSON.stringify(dna));
    expect(parsed.name).toBe('support');
  });

  it('consensus majority', () => {
    const r = runConsensus(
      [
        { agentId: 'a', value: 'yes' },
        { agentId: 'b', value: 'yes' },
        { agentId: 'c', value: 'no' },
      ],
      'majority'
    );
    expect(r.agreed).toBe(true);
    expect(r.value).toBe('yes');
  });

  it('governance gate enforces roles', () => {
    const g = new GovernanceGate(defaultAgentGovernance());
    const denied = g.evaluate({ action: 'agent.execute', roles: [] });
    expect(denied.allowed).toBe(false);
    const ok = g.evaluate({ action: 'agent.execute', roles: ['agent:run'] });
    expect(ok.allowed).toBe(true);
  });

  it('benchmark compare detects regressions', () => {
    const baseline = summarizeBenchmarkRun('b', [
      { id: '1', score: 1, durationMs: 10, passed: true },
    ]);
    const candidate = summarizeBenchmarkRun('c', [
      { id: '1', score: 0.5, durationMs: 10, passed: false },
    ]);
    const cmp = compareBenchmarkRuns(baseline, candidate);
    expect(cmp.regressions).toHaveLength(1);
  });
});
