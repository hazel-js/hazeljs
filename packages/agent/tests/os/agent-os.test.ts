import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentOS, nextWakeDate } from '../../src/os/agent-os';
import { defineAgent, daily } from '../../src/os/define-agent';
import { projectOfficeStatus } from '../../src/os/status';
import { SloTracker } from '../../src/os/slo-tracker';
import { UsageLedger } from '../../src/os/usage-ledger';
import { autonomyPolicyRules } from '../../src/os/autonomy-policies';
import { InMemoryHumanTaskService } from '../../src/run/human-task.service';
import { AgentRunStatus, type AgentRun } from '../../src/run/agent-run.types';
import { AgentState } from '../../src/types/agent.types';
import { AgentEventType } from '../../src/types/event.types';
import { PolicyEngine } from '../../src/policies/policy.engine';
import { AgentRuntime } from '../../src/runtime/agent.runtime';
import { Agent } from '../../src/decorators/agent.decorator';
import { Tool } from '../../src/decorators/tool.decorator';
import type { LLMProvider, LLMChatRequest, LLMChatResponse } from '../../src/types/llm.types';
import { createMockLlmProvider } from '../../src/llm/http-llm.provider';
import { parseDna } from '../../src/dna/agent-dna';

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-agent-os-'));
}

function run(partial: Partial<AgentRun> & Pick<AgentRun, 'id' | 'agentName' | 'status'>): AgentRun {
  const now = new Date();
  return {
    rootRunId: partial.id,
    attempt: 1,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe('Agent DNA + defineAgent', () => {
  it('captures mission, autonomy, slo, and schedule', () => {
    const dna = defineAgent({
      name: 'researcher',
      role: 'Competitive Intelligence Researcher',
      mission: 'Track important AI infrastructure developments.',
      skills: ['web.search', { name: 'email.send', requiresApproval: true }],
      autonomy: 'medium',
      policies: [{ id: 'email-approval', tool: 'email.send', effect: 'require_approval' }],
      schedule: daily('09:00'),
      slo: { successRate: 0.98, maxResponseTimeMs: 120_000 },
    });
    expect(dna.format).toBe('hazeljs.agent.dna');
    expect(dna.mission?.goal).toContain('AI infrastructure');
    expect(dna.autonomy).toBe('medium');
    expect(dna.schedule?.kind).toBe('daily');
    expect(dna.slo?.successRate).toBe(0.98);
    expect(parseDna(dna).name).toBe('researcher');
  });
});

describe('projectOfficeStatus', () => {
  it('maps desired phase and HITL onto occupancy states', () => {
    expect(projectOfficeStatus({ occupancy: { desiredPhase: 'terminated' } })).toBe('terminated');
    expect(projectOfficeStatus({ occupancy: { desiredPhase: 'paused' } })).toBe('paused');
    expect(projectOfficeStatus({ occupancy: { desiredPhase: 'sleeping' } })).toBe('sleeping');
    expect(
      projectOfficeStatus({
        occupancy: { desiredPhase: 'running' },
        pendingApprovals: 1,
      })
    ).toBe('approval_required');
    expect(
      projectOfficeStatus({
        occupancy: { desiredPhase: 'running' },
        currentRun: run({ id: 'r1', agentName: 'a', status: AgentRunStatus.FAILED }),
      })
    ).toBe('failed');
    expect(
      projectOfficeStatus({
        occupancy: { desiredPhase: 'running' },
        currentRun: run({ id: 'r2', agentName: 'a', status: AgentRunStatus.RUNNING }),
      })
    ).toBe('working');
    expect(projectOfficeStatus({ occupancy: { desiredPhase: 'running' } })).toBe('idle');
    expect(
      projectOfficeStatus({
        occupancy: { desiredPhase: 'running' },
        executorState: AgentState.WAITING_FOR_INPUT,
      })
    ).toBe('waiting');
  });
});

describe('HumanTaskService.listPending', () => {
  it('returns only pending tasks', async () => {
    const svc = new InMemoryHumanTaskService();
    const a = await svc.create({ runId: 'run-1', type: 'tool_approval', toolName: 'k8s.scale' });
    await svc.create({ runId: 'run-2', type: 'tool_approval', toolName: 'email.send' });
    await svc.resolve(a.id, 'approved', 'tester');
    const pending = await svc.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].toolName).toBe('email.send');
  });
});

describe('SloTracker + UsageLedger', () => {
  it('emits slo.breached when success rate drops below target', () => {
    const events: string[] = [];
    const tracker = new SloTracker((type) => {
      events.push(type);
    }, 10);
    tracker.setTarget('support', { successRate: 0.9 });
    tracker.record({ agentId: 'support', success: false, durationMs: 10, at: new Date() });
    tracker.record({ agentId: 'support', success: false, durationMs: 10, at: new Date() });
    expect(events).toContain(AgentEventType.SLO_BREACHED);
    const health = tracker.evaluate('support');
    expect(health?.healthy).toBe(false);
  });

  it('breaches on latency and cost targets and lists health', () => {
    const tracker = new SloTracker(undefined, 5);
    tracker.setTarget('ops', {
      successRate: 0.5,
      maxResponseTimeMs: 100,
      maxCostPerRun: 0.01,
    });
    tracker.record({
      agentId: 'ops',
      success: true,
      durationMs: 250,
      costUsd: 0.05,
      at: new Date(),
    });
    const health = tracker.evaluate('ops');
    expect(health?.healthy).toBe(false);
    expect(health?.breaches.map((b) => b.metric)).toEqual(
      expect.arrayContaining(['maxResponseTimeMs', 'maxCostPerRun'])
    );
    expect(tracker.list().some((h) => h.agentId === 'ops')).toBe(true);
    tracker.setTarget('ops'); // clear
    expect(tracker.evaluate('ops')).toBeUndefined();
  });

  it('returns healthy empty window when target set but no samples', () => {
    const tracker = new SloTracker();
    tracker.setTarget('idle', { successRate: 0.99 });
    const health = tracker.evaluate('idle');
    expect(health?.healthy).toBe(true);
    expect(health?.current.samples).toBe(0);
  });

  it('does not invent cost without a matching model profile', () => {
    const ledger = new UsageLedger([]);
    ledger.record({ agentId: 'a', at: new Date(), tokens: 1000, model: 'unknown-model' });
    expect(ledger.snapshot().estimatedCostUsd).toBeUndefined();
  });

  it('prices tokens with default profiles and filters by since', () => {
    const ledger = new UsageLedger();
    const old = new Date('2020-01-01T00:00:00Z');
    const recent = new Date('2026-08-01T00:00:00Z');
    ledger.record({
      agentId: 'researcher',
      at: old,
      tokens: 2000,
      model: 'gpt-4o-mini',
      skillName: 'web.search',
    });
    ledger.record({
      agentId: 'researcher',
      at: recent,
      tokens: 1000,
      model: 'gpt-4o-mini',
      skillName: 'http.request',
    });
    const all = ledger.snapshot();
    expect(all.tokens).toBe(3000);
    expect(all.skillCalls).toBe(2);
    expect(all.estimatedCostUsd).toBeGreaterThan(0);
    expect(all.byAgent.researcher.skillCalls).toBe(2);

    const filtered = ledger.snapshot(new Date('2025-01-01T00:00:00Z'));
    expect(filtered.tokens).toBe(1000);
    expect(filtered.skillCalls).toBe(1);
  });

  it('skips pricing when model is missing', () => {
    const ledger = new UsageLedger();
    ledger.record({ agentId: 'a', at: new Date(), tokens: 500 });
    expect(ledger.snapshot().estimatedCostUsd).toBeUndefined();
    expect(ledger.snapshot().tokens).toBe(500);
  });
});

describe('autonomyPolicyRules', () => {
  it('requires approval on sensitive tools for medium autonomy', () => {
    const rules = autonomyPolicyRules('medium', ['web.search', 'k8s.scale']);
    expect(rules.map((r) => r.tool)).toEqual(['k8s.scale']);
    expect(rules[0].effect).toBe('require_approval');
  });

  it('does not add default rules for high autonomy', () => {
    expect(autonomyPolicyRules('high', ['k8s.scale'])).toEqual([]);
  });
});

describe('nextWakeDate', () => {
  it('schedules the next daily occurrence', () => {
    const now = new Date('2026-08-24T18:00:00');
    const next = nextWakeDate('daily', '09:00', now);
    expect(next.getHours()).toBe(9);
    expect(next.getDate()).toBe(25);
  });
});

describe('AgentOS control plane', () => {
  let root: string;
  const planes: AgentOS[] = [];

  beforeEach(() => {
    root = tmpRoot();
    planes.length = 0;
  });

  afterEach(async () => {
    await Promise.all(planes.map((p) => p.dispose()));
    fs.rmSync(root, { recursive: true, force: true });
  });

  function createOs(
    handlers?: Record<string, (input: Record<string, unknown>) => Promise<unknown>>
  ) {
    const plane = new AgentOS({
      projectRoot: root,
      llmProvider: createMockLlmProvider('Done.'),
      skillHandlers: handlers,
    });
    planes.push(plane);
    return plane;
  }

  it('deploys DNA, lists the agent, and persists across a new AgentOS', async () => {
    const osPlane = createOs();
    const deployed = await osPlane.deploy(
      defineAgent({
        name: 'researcher',
        mission: 'Research competitor announcements',
        skills: ['web.search'],
        autonomy: 'high',
      })
    );
    expect(deployed.id).toBe('researcher');
    expect(deployed.status).toBe('idle');
    expect(deployed.dna.mission?.goal).toContain('competitor');

    const listed = await osPlane.list();
    expect(listed.map((a) => a.id)).toContain('researcher');

    const reloaded = createOs();
    await reloaded.recover();
    const again = await reloaded.get('researcher');
    expect(again?.dna.name).toBe('researcher');
  });

  it('pause persists and start is blocked until resume', async () => {
    const osPlane = createOs();
    await osPlane.deploy(
      defineAgent({ name: 'invoice', mission: 'Follow up invoices', skills: ['email.send'] })
    );
    const paused = await osPlane.pause('invoice');
    expect(paused.status).toBe('paused');

    await expect(osPlane.start('invoice')).rejects.toThrow(/paused/);

    const reloaded = createOs();
    await reloaded.recover();
    expect((await reloaded.get('invoice'))?.status).toBe('paused');

    const resumed = await reloaded.resume('invoice');
    expect(resumed.status).toBe('idle');
    const started = await reloaded.start('invoice', 'Follow up unpaid invoices');
    expect(started?.status).toBe(AgentRunStatus.COMPLETED);
  });

  it('sleepUntil marks sleeping and recover rearms wake', async () => {
    const osPlane = createOs();
    await osPlane.deploy(defineAgent({ name: 'batch', mission: 'Nightly batch', skills: [] }));
    const when = new Date(Date.now() + 60_000);
    const sleeping = await osPlane.sleepUntil('batch', when);
    expect(sleeping.status).toBe('sleeping');
    expect(sleeping.occupancy.nextWakeAt).toBeDefined();

    const reloaded = createOs();
    const result = await reloaded.recover();
    expect(result.rearmed).toBeGreaterThanOrEqual(1);
    expect((await reloaded.get('batch'))?.status).toBe('sleeping');
  });

  it('denies a forbidden tool via DNA policy without executing it', async () => {
    let called = 0;
    const osPlane = createOs({
      'payments.wire': async () => {
        called += 1;
        return { ok: true };
      },
    });
    await osPlane.deploy(
      defineAgent({
        name: 'cashier',
        mission: 'Never wire money',
        skills: ['payments.wire'],
        autonomy: 'high',
        policies: [
          {
            id: 'deny-wire',
            tool: 'payments.wire',
            effect: 'deny',
            reason: 'Wires are forbidden',
          },
        ],
      })
    );

    const engine = osPlane.runtime.getPolicyEngine() as PolicyEngine;
    const decision = engine.evaluate('payments.wire', { amount: 5000 });
    expect(decision.allowed).toBe(false);
    expect(decision.effect).toBe('deny');

    const tools = osPlane.listSkills();
    expect(tools.map((t) => t.name)).toContain('payments.wire');
    expect(called).toBe(0);
  });

  it('HITL: sensitive action suspends, human approves, run resumes and tool executes', async () => {
    const scaleCalls: Array<Record<string, unknown>> = [];

    function llmThatScalesThenAnswers(): LLMProvider {
      let n = 0;
      return {
        async chat(_req: LLMChatRequest): Promise<LLMChatResponse> {
          n += 1;
          if (
            n === 1 ||
            (_req.tools?.length &&
              n <= 4 &&
              !_req.messages.some((m) => String(m.content).includes('[Tool')))
          ) {
            if (_req.tools?.some((t) => t.function.name === 'k8s.scale')) {
              return {
                content: '',
                finishReason: 'tool_calls',
                tool_calls: [
                  {
                    id: 'call_scale',
                    type: 'function',
                    function: {
                      name: 'k8s.scale',
                      arguments: JSON.stringify({ from: 3, to: 6 }),
                    },
                  },
                ],
              };
            }
          }
          if (/score:/i.test(String(_req.messages[0]?.content))) {
            return { content: 'score: 96\nfeedback: PASS', finishReason: 'stop' };
          }
          return { content: 'Scaled and validated recovery.', finishReason: 'stop' };
        },
      };
    }

    const osPlane = new AgentOS({
      projectRoot: root,
      llmProvider: llmThatScalesThenAnswers(),
      skillHandlers: {
        'k8s.scale': async (input) => {
          scaleCalls.push(input);
          return { ok: true, demo: true, ...input };
        },
      },
    });
    planes.push(osPlane);

    await osPlane.deploy(
      defineAgent({
        name: 'devops',
        mission: 'Remediate latency by scaling',
        skills: [{ name: 'k8s.scale', requiresApproval: true }],
        autonomy: 'low',
      })
    );

    const runResult = await osPlane.start('devops', 'API latency exceeded SLO. Scale production.');
    expect([AgentRunStatus.SUSPENDED, AgentRunStatus.WAITING_FOR_HUMAN]).toContain(
      runResult?.status
    );
    expect(scaleCalls).toHaveLength(0);

    const pending = await osPlane.listApprovals();
    expect(pending.length).toBeGreaterThan(0);
    await osPlane.dispose();

    const reloaded = new AgentOS({
      projectRoot: root,
      llmProvider: llmThatScalesThenAnswers(),
      skillHandlers: {
        'k8s.scale': async (input) => {
          scaleCalls.push(input);
          return { ok: true, demo: true, ...input };
        },
      },
    });
    planes.push(reloaded);
    await reloaded.recover();
    const stillPending = await reloaded.listApprovals();
    expect(stillPending.length).toBeGreaterThan(0);
    await reloaded.approve(stillPending[0].id, 'sre');
    expect(scaleCalls.length).toBeGreaterThan(0);
  });
});

describe('observe loop stage', () => {
  @Agent({ name: 'observe-agent', description: 'obs', systemPrompt: 'Be brief.' })
  class ObserveAgent {
    @Tool({ name: 'noop', description: 'noop' })
    async noop(): Promise<{ ok: boolean }> {
      return { ok: true };
    }
  }

  it('emits LOOP_ITERATION with stage observe', async () => {
    const stages: string[] = [];
    const runtime = new AgentRuntime({
      llmProvider: createMockLlmProvider('score: 96\nfeedback: PASS'),
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(ObserveAgent);
    runtime.registerAgentInstance('observe-agent', new ObserveAgent());
    runtime.on(AgentEventType.LOOP_ITERATION, (e) => {
      const event = e as { data?: { stage?: string } };
      if (event.data?.stage) stages.push(event.data.stage);
    });
    await runtime.execute('observe-agent', 'Say hi', {
      maxSteps: 2,
      loop: { maxIterations: 1, successScore: 50, stages: ['observe', 'execute'] },
    });
    expect(stages).toContain('observe');
  });
});
