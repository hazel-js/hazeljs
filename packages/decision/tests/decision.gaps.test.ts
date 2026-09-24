/**
 * Gap-fill tests: DecisionModule, HazelDecisionAgent, LLM stages, audit.
 */

import 'reflect-metadata';
import {
  getAgentMetadata,
  getAgentTools,
  createMockLlmProvider,
  AgentRuntime,
} from '@hazeljs/agent';
import {
  HazelDecisionAgent,
  HazelAgentDecisionProvider,
  createGovernedDecisionRuntime,
  Decision,
  getRegisteredDecisionMethods,
  getDecisionMetadata,
  incidentRemediationDefinition,
  incidentState,
  DecisionInvalidOutputError,
  llmJudge,
} from '../src';

describe('HazelDecisionAgent', () => {
  it('is registered as an @Agent with stage @Tool methods', () => {
    const meta = getAgentMetadata(HazelDecisionAgent);
    expect(meta?.name).toBe('hazel-decision-agent');
    const tools = getAgentTools(HazelDecisionAgent);
    expect(tools).toEqual(
      expect.arrayContaining([
        'extractEvidenceTool',
        'evaluateCandidatesTool',
        'judgeTool',
        'criticTool',
        'confidenceTool',
      ])
    );
  });

  it('registers on AgentRuntime', () => {
    const runtime = new AgentRuntime({
      llmProvider: createMockLlmProvider(),
      durableSuspend: false,
    });
    const agent = new HazelDecisionAgent();
    runtime.registerAgent(HazelDecisionAgent);
    runtime.registerAgentInstance('hazel-decision-agent', agent);
    expect(runtime.getAgentInstance('hazel-decision-agent')).toBe(agent);
  });
});

describe('LLM judge stage', () => {
  it('rejects choices outside the allowed set', async () => {
    const generator = {
      generateObject: async () => ({
        decision: 'hack-the-planet',
        score: 0.99,
        evidenceIds: [],
      }),
    };
    await expect(
      llmJudge(generator, {
        objective: 'x',
        choices: ['retry', 'rollback'] as const,
        evidence: [],
        candidates: [
          { candidate: 'retry', score: 0.1, supportingEvidence: [] },
          { candidate: 'rollback', score: 0.9, supportingEvidence: [] },
        ],
      })
    ).rejects.toBeInstanceOf(DecisionInvalidOutputError);
  });

  it('uses LLM judge when generateObject is injected, then still governs via runtime', async () => {
    const generator = {
      generateObject: jest.fn(async (_prompt: string, schema: { parse?: unknown }) => {
        void schema;
        return {
          decision: 'rollback',
          score: 0.93,
          evidenceIds: ['error-rate-change'],
          status: 'confirmed',
          notes: ['ok'],
        };
      }),
    };

    const provider = new HazelAgentDecisionProvider({ generateObject: generator });
    const result = await provider.decide({
      decisionId: 'dec_test',
      name: 'incident-remediation',
      objective: incidentRemediationDefinition.objective,
      state: incidentState,
      choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
      risk: { level: 'high' },
      strategy: 'deliberate',
      definition: incidentRemediationDefinition,
    });

    expect(result.decision).toBe('rollback');
    expect(result.stages).toEqual(expect.arrayContaining(['judge-llm']));
    expect(result.modelCalls).toBeGreaterThanOrEqual(1);
    expect(generator.generateObject).toHaveBeenCalled();
  });

  it('falls back to heuristic judge when LLM provider fails', async () => {
    const generator = {
      generateObject: async () => {
        throw new Error('model unavailable');
      },
    };
    const provider = new HazelAgentDecisionProvider({ generateObject: generator });
    const result = await provider.decide({
      decisionId: 'dec_fb',
      objective: incidentRemediationDefinition.objective,
      state: incidentState,
      choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
      risk: { level: 'high' },
      strategy: 'deliberate',
      definition: incidentRemediationDefinition,
    });
    expect(result.decision).toBe('rollback');
    expect(result.stages).toEqual(expect.arrayContaining(['judge-llm-fallback']));
  });
});

describe('DecisionModule / audit', () => {
  it('createGovernedDecisionRuntime wires audit events', async () => {
    const logs: unknown[] = [];
    const runtime = createGovernedDecisionRuntime({
      auditService: {
        log: (e) => {
          logs.push(e);
        },
      },
    });
    runtime.registry.register({
      name: 'incident-remediation',
      ...incidentRemediationDefinition,
    });

    await runtime.decide({
      name: 'incident-remediation',
      objective: 'x',
      state: incidentState,
      choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
      risk: 'high',
      provider: 'hazel-agent',
    });

    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect((logs[0] as { action: string }).action).toBe('decision.run');
  });
});

describe('@Decision decorator', () => {
  class Demo {
    @Decision({
      name: 'demo-decision',
      choices: ['a', 'b'],
      risk: 'low',
      provider: 'hazel-agent',
    })
    async run(): Promise<string> {
      return 'a';
    }
  }

  it('records method metadata', () => {
    const demo = new Demo();
    const meta = getDecisionMetadata(Object.getPrototypeOf(demo), 'run');
    expect(meta?.name).toBe('demo-decision');
    expect(getRegisteredDecisionMethods().some((m) => m.name === 'demo-decision')).toBe(true);
  });
});
