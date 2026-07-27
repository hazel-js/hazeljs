/**
 * Deep coverage for Agent OS modules that sit below global Jest thresholds.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Agent } from '../src/decorators/agent.decorator';
import { AgentRuntime } from '../src/runtime/agent.runtime';
import { AgentState } from '../src/types/agent.types';
import { AgentEventType } from '../src/types/event.types';
import { executeWithContract, validateAgentContract } from '../src/contracts/agent-contract';
import { runRecoveryLadder } from '../src/recovery/recovery-ladder';
import { createSkillInvoker, openApiToSkills } from '../src/skills/openapi-skills';
import { evolveSystemPrompt, runEvolutionLoop } from '../src/evolution/agent-evolution';
import { defaultAgentGovernance, GovernanceGate } from '../src/governance/governance';
import { collectConsensusVotes, runConsensus } from '../src/consensus/consensus';
import { exportAgentDna, parseDna, serializeDna, toMarketplacePackage } from '../src/dna/agent-dna';
import { hotReloadAgentDna } from '../src/dna/hot-reload';
import {
  installAgentPackage,
  loadMarketplacePackage,
  saveMarketplacePackage,
} from '../src/dna/marketplace';
import {
  memoryGraphFromKnowledgeGraph,
  syncMemoryGraphToKnowledgeGraph,
} from '../src/memory-graph/graphrag-bridge';
import { AgentMemoryGraph } from '../src/memory-graph/memory-graph';
import {
  compareBenchmarkRuns,
  runBenchmark,
  summarizeBenchmarkRun,
} from '../src/benchmark/benchmark';
import { CostOptimizer, estimateCost } from '../src/cost/cost-optimizer';
import { runAgentSimulator } from '../src/simulator/agent-simulator';
import { jaccardSimilarity, runDigitalTwin, shouldRunCanary } from '../src/twin/digital-twin';
import { PolicyEngine, defaultPiiMaskPolicies } from '../src/policies/policy.engine';
import { AgentTimelineRecorder } from '../src/timeline/timeline.recorder';
import { TimeTravelDebugger } from '../src/timetravel/time-travel';
import { assessKnowledgeFreshness } from '../src/knowledge/knowledge-freshness';
import { LogLevel } from '../src/utils/logger';

function baseResult(overrides: Record<string, unknown> = {}) {
  return {
    executionId: 'e1',
    agentId: 'a',
    state: AgentState.COMPLETED,
    response: 'Refund processed successfully',
    steps: [
      {
        id: 's1',
        type: 'tool',
        action: { toolName: 'lookup', toolCalls: [{ toolName: 'lookup' }] },
      },
    ],
    metadata: {},
    duration: 100,
    completedAt: new Date(),
    ...overrides,
  } as never;
}

describe('Agent OS coverage', () => {
  describe('contracts', () => {
    it('covers input/output/latency/cost/tools/custom violations and fallback', async () => {
      const bad = await validateAgentContract(
        {
          name: 'strict',
          inputIncludes: /refund/i,
          outputIncludes: 'never-matches',
          maxLatencyMs: 10,
          maxCostUsd: 0.01,
          requiredTools: ['missing'],
          forbiddenTools: ['lookup'],
          custom: async () => false,
          fallbackAgent: 'fallback',
        },
        'hello',
        baseResult({ duration: 50 }),
        1
      );
      expect(bad.ok).toBe(false);
      expect(bad.violations.length).toBeGreaterThan(3);
      expect(bad.fallbackAgent).toBe('fallback');

      const ok = await validateAgentContract(
        {
          name: 'ok',
          inputIncludes: 'refund',
          outputIncludes: /refund/i,
          maxLatencyMs: 500,
          maxCostUsd: 1,
          requiredTools: ['lookup'],
          custom: () => true,
        },
        'I want a refund',
        baseResult(),
        0.1
      );
      expect(ok.ok).toBe(true);

      const withFallback = await executeWithContract({
        contract: {
          name: 'fb',
          outputIncludes: 'ok',
          fallbackAgent: 'fallback',
        },
        input: 'x',
        primaryAgent: 'primary',
        execute: async (name) =>
          baseResult({
            response: name === 'fallback' ? 'ok' : 'bad',
            agentId: name,
          }),
      });
      expect(withFallback.usedFallback).toBe(true);
      expect(withFallback.validation.ok).toBe(true);

      const noFallback = await executeWithContract({
        contract: { name: 'nf', outputIncludes: 'ok' },
        input: 'x',
        primaryAgent: 'primary',
        execute: async () => baseResult({ response: 'bad' }),
      });
      expect(noFallback.usedFallback).toBe(false);
      expect(noFallback.validation.ok).toBe(false);
    });
  });

  describe('recovery ladder', () => {
    it('covers circuit breaker, fallback, hitl, and fail paths', async () => {
      const open = await runRecoveryLadder({
        execute: async () => {
          throw new Error('boom');
        },
        ladder: {
          steps: ['circuit_breaker', 'fail'],
          isCircuitClosed: () => false,
        },
      });
      expect(open.success).toBe(false);
      expect(open.error?.message).toMatch(/Circuit breaker/);

      const fallback = await runRecoveryLadder({
        execute: async () => {
          throw new Error('primary');
        },
        executeFallback: async () => 'fb',
        ladder: { steps: ['retry', 'fallback_agent', 'fail'], maxRetries: 1 },
      });
      expect(fallback.success).toBe(true);
      expect(fallback.usedFallback).toBe(true);

      const hitl = await runRecoveryLadder({
        execute: async () => {
          throw new Error('need human');
        },
        ladder: {
          steps: ['retry', 'hitl', 'fail'],
          maxRetries: 1,
          onHitl: async () => true,
        },
      });
      // still fails after approved retry throws again
      expect(hitl.success).toBe(false);

      let approvedOnce = false;
      const hitlOk = await runRecoveryLadder({
        execute: async () => {
          if (!approvedOnce) {
            approvedOnce = true;
            throw new Error('first');
          }
          return 'after-hitl';
        },
        ladder: {
          steps: ['retry', 'hitl', 'fail'],
          maxRetries: 1,
          onHitl: async () => true,
          recordFailure: () => undefined,
          recordSuccess: () => undefined,
        },
      });
      expect(hitlOk.success).toBe(true);
      expect(hitlOk.result).toBe('after-hitl');

      const denied = await runRecoveryLadder({
        execute: async () => {
          throw new Error('x');
        },
        ladder: {
          steps: ['retry', 'hitl', 'fail'],
          maxRetries: 1,
          onHitl: async () => false,
        },
      });
      expect(denied.success).toBe(false);

      const skipFallback = await runRecoveryLadder({
        execute: async () => {
          throw new Error('x');
        },
        ladder: {
          steps: ['fallback_agent', 'fail'],
          fallbackAgent: 'a',
        },
      });
      expect(skipFallback.success).toBe(false);
    });
  });

  describe('openapi skills', () => {
    it('extracts tools without operationId and builds invokers', async () => {
      const tools = openApiToSkills({
        servers: [{ url: 'https://api.example.com/' }],
        paths: {
          '/items/{id}': {
            post: {
              summary: 'Create item',
              parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                { name: 'q', in: 'query', schema: { type: 'string' } },
                { name: 'X-Token', in: 'header', schema: { type: 'string' } },
              ],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        name: { type: 'string', description: 'Item name' },
                        note: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
            parameters: {} as never, // non-http key skipped via method filter
          },
          '/': {
            get: { description: 'root' },
          },
        },
      });
      expect(tools.some((t) => t.name === 'post_items_id')).toBe(true);
      expect(tools.some((t) => t.name === 'get_root')).toBe(true);

      const tool = tools.find((t) => t.name === 'post_items_id')!;
      const fetchMock = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => '{"ok":true}',
      });
      const prev = global.fetch;
      global.fetch = fetchMock as never;
      try {
        const invoker = createSkillInvoker(tool, { headers: { Accept: 'application/json' } });
        const json = await invoker({
          id: '1',
          q: 'x',
          'X-Token': 't',
          name: 'n',
          extra: 1,
        });
        expect(json).toEqual({ status: 200, data: { ok: true } });

        fetchMock.mockResolvedValueOnce({
          status: 500,
          text: async () => 'not-json',
        });
        const text = await invoker({ id: '2', name: 'n' });
        expect(text).toEqual({ status: 500, data: 'not-json' });
      } finally {
        global.fetch = prev;
      }
    });
  });

  describe('evolution', () => {
    it('covers empty failures, LLM path, and evolution loop', async () => {
      const empty = await evolveSystemPrompt({ currentPrompt: 'hi', failures: [] });
      expect(empty.changes).toEqual([]);

      const llmOk = await evolveSystemPrompt({
        currentPrompt: 'hi',
        failures: [{ input: 'a', error: 'e' }],
        llm: {
          complete: async () =>
            JSON.stringify({
              revisedSystemPrompt: 'better',
              rationale: 'r',
              changes: ['c'],
            }),
        },
      });
      expect(llmOk.revisedSystemPrompt).toBe('better');

      const llmBad = await evolveSystemPrompt({
        currentPrompt: 'hi',
        failures: [{ input: 'a', output: 'o', expectedHint: 'h' }],
        llm: { complete: async () => 'not-json' },
      });
      expect(llmBad.revisedSystemPrompt).toContain('Lessons');

      const passed = await runEvolutionLoop({
        systemPrompt: 'base',
        cases: [{ input: 'x', assert: () => true }],
        run: async () => 'ok',
        maxRounds: 2,
      });
      expect(passed.passed).toBe(true);

      const failed = await runEvolutionLoop({
        systemPrompt: 'base',
        cases: [
          { input: 'x', assert: () => false, expectedHint: 'y' },
          {
            input: 'z',
            assert: () => true,
          },
        ],
        run: async (_p, input) => {
          if (input === 'z') throw new Error('boom');
          return 'nope';
        },
        maxRounds: 1,
      });
      expect(failed.passed).toBe(false);
      expect(failed.history).toHaveLength(1);
    });
  });

  describe('governance', () => {
    it('covers residency, packs, audit, and default allow', () => {
      const g = new GovernanceGate(defaultAgentGovernance());
      expect(g.evaluate({ action: 'unknown', roles: [] }).allowed).toBe(true);

      g.setPolicy('data.read', {
        requiredRoles: ['reader'],
        allowedResidencies: ['eu'],
        requiredPacks: ['gdpr'],
        denyReason: 'blocked',
      });
      expect(g.evaluate({ action: 'data.read', roles: [], residency: 'us' }).allowed).toBe(false);
      expect(
        g.evaluate({ action: 'data.read', roles: ['reader'], residency: 'us' }).reason
      ).toMatch(/Residency|blocked/);
      expect(
        g.evaluate({
          action: 'data.read',
          roles: ['reader'],
          residency: 'eu',
          compliancePacks: [],
        }).allowed
      ).toBe(false);
      expect(
        g.evaluate({
          action: 'data.read',
          roles: ['reader'],
          residency: 'eu',
          compliancePacks: ['gdpr'],
          userId: 'u',
          tenantId: 't',
        }).allowed
      ).toBe(true);
      expect(g.getAuditLog().length).toBeGreaterThan(0);

      expect(
        g.evaluate({
          action: 'agent.export_dna',
          roles: ['agent:admin'],
          compliancePacks: ['soc2'],
        }).allowed
      ).toBe(true);
    });
  });

  describe('consensus', () => {
    it('covers strategies and vote collection', async () => {
      expect(runConsensus([], 'majority').agreed).toBe(false);
      expect(runConsensus([{ agentId: 'a', value: 'yes' }], 'unanimous').agreed).toBe(true);
      expect(
        runConsensus(
          [
            { agentId: 'a', value: 'yes' },
            { agentId: 'b', value: 'no' },
          ],
          'unanimous'
        ).agreed
      ).toBe(false);
      expect(
        runConsensus(
          [
            { agentId: 'a', value: 'yes', weight: 3 },
            { agentId: 'b', value: 'no', weight: 1 },
          ],
          'weighted'
        ).agreed
      ).toBe(true);
      expect(
        runConsensus(
          [
            { agentId: 'a', value: '  ' },
            { agentId: 'b', value: 'ok' },
          ],
          'first_valid'
        ).value
      ).toBe('ok');
      expect(runConsensus([{ agentId: 'a', value: '   ' }], 'first_valid').agreed).toBe(false);

      const votes = await collectConsensusVotes({
        agentIds: ['a', 'b'],
        input: 'q',
        weights: { a: 2 },
        run: async (id) => ({ response: id === 'a' ? 'yes' : 'no', confidence: 0.5 }),
      });
      expect(votes).toHaveLength(2);
    });
  });

  describe('dna + marketplace + hot reload', () => {
    it('serializes, validates, and installs packages', () => {
      const dna = exportAgentDna({
        name: 'bot',
        description: 'd',
        systemPrompt: 'p',
        model: 'm',
        tools: [{ name: 't' }],
        policies: [{ id: 'r', tool: '*', effect: 'allow' }],
        metadata: { k: 1 },
      });
      expect(serializeDna(dna)).toContain('hazeljs.agent.dna');
      expect(parseDna(dna).name).toBe('bot');
      expect(() => parseDna({ ...(dna as object), format: 'bad' } as never)).toThrow(/Invalid DNA/);
      expect(() => parseDna({ format: 'hazeljs.agent.dna' } as never)).toThrow(/missing name/);

      const pkg = toMarketplacePackage(dna, { readme: 'r', keywords: ['k'] });
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-cov-'));
      const dnaFile = path.join(dir, 'bot.dna.json');
      const pkgFile = path.join(dir, 'nested', 'pkg.json');
      fs.writeFileSync(dnaFile, JSON.stringify(dna));
      expect(loadMarketplacePackage(dnaFile).dna.name).toBe('bot');
      saveMarketplacePackage(pkg, pkgFile);
      expect(loadMarketplacePackage(pkgFile).name).toContain('bot');

      const agents = new Map<string, Record<string, unknown>>([
        ['bot', { name: 'bot', systemPrompt: 'old', description: 'old', model: 'old' }],
      ]);
      const tools: string[] = [];
      const engine = new PolicyEngine();
      const target = {
        getAgent: (n: string) => agents.get(n) as never,
        patchAgent: (n: string, p: Record<string, unknown>) => {
          agents.set(n, { ...agents.get(n), ...p });
        },
        setPolicyEngine: (_e: PolicyEngine) => undefined,
        getPolicyEngine: () => engine,
        registerDynamicTool: (_a: string, t: { name: string }) => tools.push(t.name),
      };

      expect(() => hotReloadAgentDna(target, exportAgentDna({ name: 'missing' }))).toThrow(
        /not registered/
      );

      const reloaded = hotReloadAgentDna(target, dna);
      expect(reloaded.updated).toEqual(
        expect.arrayContaining([
          'systemPrompt',
          'description',
          'model',
          'metadata',
          'policies',
          'tools',
        ])
      );
      expect(installAgentPackage(target, pkg).agentName).toBe('bot');
      expect(installAgentPackage(target, dnaFile).agentName).toBe('bot');
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('graphrag bridge + memory graph', () => {
    it('round-trips nodes and edges', () => {
      const kg = {
        entities: new Map([
          ['1', { id: '1', name: 'Ada', type: 'person', description: 'dev', metadata: { x: 1 } }],
          ['2', { id: '2', name: 'Hazel', type: 'org' }],
        ]),
        relationships: new Map([
          [
            'r1',
            {
              id: 'r1',
              sourceId: '1',
              targetId: '2',
              type: 'works_at',
              weight: 1,
              metadata: { y: 2 },
            },
          ],
          ['bad', { id: 'bad', sourceId: 'missing', targetId: '2', type: 'x' }],
        ]),
        addEntity: jest.fn(),
        addRelationship: jest.fn(),
      };
      const g = memoryGraphFromKnowledgeGraph(kg, { domain: 'test' });
      expect(g.getNode('1')?.label).toBe('Ada');
      expect(g.neighbors('1', 'works_at')).toHaveLength(1);
      expect(g.search('ada', { type: 'person', domain: 'test', limit: 1 })).toHaveLength(1);

      const synced = syncMemoryGraphToKnowledgeGraph(g, kg);
      expect(synced.nodes).toBe(2);
      expect(synced.edges).toBe(1);

      const emptyKg = { entities: new Map(), relationships: new Map() };
      expect(syncMemoryGraphToKnowledgeGraph(g, emptyKg)).toEqual({ nodes: 0, edges: 0 });

      const round = AgentMemoryGraph.fromJSON(g.toJSON());
      expect(round.search('Hazel')).toHaveLength(1);
      expect(() => g.link({ from: '1', to: 'nope', relation: 'x' })).toThrow();
    });
  });

  describe('benchmark / cost / simulator / twin / knowledge', () => {
    it('covers remaining helpers', async () => {
      expect(summarizeBenchmarkRun('empty', []).averageScore).toBe(0);
      const run = await runBenchmark({
        label: 'r',
        commit: 'abc',
        cases: [
          { id: '1', input: 'a' },
          { id: '2', input: 'b' },
        ],
        run: async (_input, id) => {
          if (id === '2') throw new Error('boom');
          return { score: 1, durationMs: 5, costUsd: 0.1, passed: true };
        },
      });
      expect(run.cases).toHaveLength(2);

      const improved = compareBenchmarkRuns(
        summarizeBenchmarkRun('b', [{ id: '1', score: 0.5, durationMs: 10, passed: true }]),
        summarizeBenchmarkRun('c', [{ id: '1', score: 1, durationMs: 5, passed: true }])
      );
      expect(improved.improvements).toHaveLength(1);

      const opt = new CostOptimizer();
      opt.setProfiles([
        {
          id: 'cheap',
          provider: 'x',
          tier: 'economy',
          inputPer1k: 0.001,
          outputPer1k: 0.001,
          quality: 0.5,
        },
      ]);
      expect(estimateCost(opt.selectModel({ qualityBias: 1 }), 1000, 500)).toBeGreaterThan(0);
      expect(() => opt.selectModel({ maxCostUsd: 0, requireTier: ['premium'] })).toThrow(
        /No model/
      );

      const sim = await runAgentSimulator({
        cases: [
          { id: '1', input: 'a', weight: 2 },
          { id: '2', input: 'b' },
        ],
        iterations: 4,
        concurrency: 2,
        run: async (_i, id) => {
          if (id === '2') throw new Error('fail');
          return { ok: true, durationMs: 3 };
        },
      });
      expect(sim.total).toBe(4);

      expect(jaccardSimilarity('', '')).toBe(1);
      const twin = await runDigitalTwin({
        runPrimary: async () => ({ response: 'hello world', duration: 1 }),
        runTwin: async () => {
          throw new Error('twin down');
        },
        swallowTwinErrors: true,
      });
      expect(twin.compare.match).toBe(false);
      expect(shouldRunCanary(0)).toBe(false);
      expect(shouldRunCanary(1)).toBe(true);

      const now = Date.now();
      const fresh = assessKnowledgeFreshness(
        [
          {
            id: '1',
            updatedAt: new Date(now).toISOString(),
            confidence: 0.9,
            metadata: { indexedAt: now },
          },
          { metadata: { id: '2', expiresAt: 'not-a-date', confidence: 0.1 } },
        ],
        { maxAgeMs: 60_000, minConfidence: 0.5, now }
      );
      expect(fresh.recommendation).toBe('low_confidence');
    });
  });

  describe('time travel edge cases', () => {
    it('covers edit kinds, continue options, replay, and clear', () => {
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
        data: 'not-object',
      } as never);

      const tt = new TimeTravelDebugger(timeline);
      expect(() => tt.fork('missing')).toThrow(/No timeline/);
      const fork = tt.fork('e1');
      expect(tt.getFork(fork.forkId)?.forkId).toBe(fork.forkId);
      expect(() => tt.edit('bad', { stepId: 'x', kind: 'prompt', value: 'y' })).toThrow(
        /Unknown fork/
      );
      expect(() => tt.edit(fork.forkId, { stepId: 'missing', kind: 'prompt', value: 'y' })).toThrow(
        /not found/
      );

      tt.edit(fork.forkId, { stepId: fork.steps[0].id, kind: 'thought', value: 't' });
      tt.edit(fork.forkId, { stepId: fork.steps[0].id, kind: 'tool_output', value: { ok: 1 } });
      tt.edit(fork.forkId, { stepId: fork.steps[0].id, kind: 'metadata', value: { m: 1 } });

      expect(
        tt.prepareContinue(fork.forkId, { afterStepId: fork.steps[0].id }).stepsBeforeContinue
      ).toHaveLength(1);
      expect(tt.prepareContinue(fork.forkId, { afterIndex: 0 }).stepsBeforeContinue).toHaveLength(
        1
      );
      expect(() => tt.prepareContinue('bad')).toThrow(/Unknown fork/);
      expect(() => tt.prepareContinue(fork.forkId, { afterStepId: 'nope' })).toThrow(/not found/);
      expect(tt.replay('e1')).toHaveLength(2);
      tt.clear();
      expect(tt.getFork(fork.forkId)).toBeUndefined();
    });
  });

  describe('policy engine extras', () => {
    it('covers allow+mask, require_approval, nested masks, and wildcards', () => {
      const engine = new PolicyEngine([
        ...defaultPiiMaskPolicies(),
        {
          id: 'approve-write',
          tool: 'write',
          effect: 'require_approval',
          priority: 5,
        },
        {
          id: 'allow-mask',
          tool: 'lookup',
          effect: 'allow',
          maskFields: ['user.email', 'token'],
          priority: 2,
        },
        {
          id: 'when',
          tool: '*',
          effect: 'deny',
          whenInputIncludes: 'forbidden',
          priority: 100,
        },
      ]);
      engine.addRule({ id: 'extra', tool: 'noop', effect: 'allow' });
      expect(engine.evaluate('noop', {}).allowed).toBe(true);
      const masked = engine.evaluate('lookup', {
        token: 'secret',
        user: { email: 'a@b.c', name: 'Ada' },
      });
      expect(masked.input.token).toBe('[REDACTED]');
      expect((masked.input.user as { email: string }).email).toBe('[REDACTED]');
      expect(engine.evaluate('any', { note: 'forbidden' }).allowed).toBe(false);
      expect(engine.evaluate('unknown', {}).allowed).toBe(true);
    });
  });

  describe('runtime DNA APIs', () => {
    it('hot-reloads and installs DNA via AgentRuntime', () => {
      @Agent({ name: 'cov-agent', description: 'old', systemPrompt: 'old' })
      class CovAgent {}

      const runtime = new AgentRuntime({
        enableRetry: false,
        enableCircuitBreaker: false,
        logLevel: LogLevel.FATAL,
        governanceGate: new GovernanceGate(defaultAgentGovernance()),
      });
      runtime.registerAgent(CovAgent);
      runtime.registerAgentInstance('cov-agent', new CovAgent());

      const dna = exportAgentDna({
        name: 'cov-agent',
        systemPrompt: 'new',
        description: 'new',
        model: 'gpt',
        tools: [{ name: 'dyn' }],
        policies: [{ id: 'p', tool: '*', effect: 'allow' }],
      });
      expect(runtime.hotReloadDna(dna).updated).toContain('systemPrompt');
      expect(runtime.getPolicyEngine()).toBeDefined();
      expect(runtime.getCostOptimizer()).toBeDefined();
      expect(runtime.getGovernanceGate()).toBeDefined();
      expect(runtime.getTimeTravel()).toBeDefined();
      expect(runtime.getTimelineRecorder()).toBeDefined();
      expect(runtime.getTimeline({ agentName: 'cov-agent' })).toEqual([]);

      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-rt-'));
      const file = path.join(dir, 'cov.dna.json');
      fs.writeFileSync(file, JSON.stringify(dna));
      expect(runtime.installAgentPackage(file).agentName).toBe('cov-agent');
      expect(runtime.installAgentPackage(toMarketplacePackage(dna)).agentName).toBe('cov-agent');
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });
});
