/**
 * Decision pipeline → Flow graph projection.
 *
 * Produces a portable stage graph compatible with `@hazeljs/flow` shapes without
 * requiring Flow as a hard dependency. DecisionRuntime remains the authority;
 * this is projection / orchestration scaffolding — not a second decision engine.
 */

import type { DecisionExecutionStrategy, DecisionRiskLevel } from '../types';
import {
  selectExecutionStrategy,
  strategyIncludesCandidates,
  strategyIncludesCritic,
  strategyIncludesEvidence,
} from '../runtime/complexity-router';

export type DecisionFlowStageId =
  | 'route'
  | 'evidence'
  | 'candidates'
  | 'judge'
  | 'critic'
  | 'confidence'
  | 'policy'
  | 'skillgate'
  | 'hitl'
  | 'execution'
  | 'complete';

export interface DecisionFlowNode {
  id: DecisionFlowStageId;
  label: string;
  /** Whether this stage is active for the selected strategy. */
  enabled: boolean;
  description?: string;
}

export interface DecisionFlowEdge {
  from: DecisionFlowStageId;
  to: DecisionFlowStageId;
  /** Optional condition label for UI (not executable). */
  when?: string;
  priority?: number;
}

/** Serializable projection for Lab / control-plane / Flow registration. */
export interface DecisionFlowProjection {
  flowId: string;
  version: string;
  entry: DecisionFlowStageId;
  strategy: DecisionExecutionStrategy;
  risk: DecisionRiskLevel;
  nodes: DecisionFlowNode[];
  edges: DecisionFlowEdge[];
}

export interface ProjectDecisionFlowInput {
  name?: string;
  version?: string;
  risk?: DecisionRiskLevel;
  choiceCount?: number;
  strategy?: DecisionExecutionStrategy | 'auto';
  forceHumanRequired?: boolean;
  /** Include skillgate → execution path (default true). */
  includeExecution?: boolean;
}

const STAGE_META: Record<DecisionFlowStageId, { label: string; description: string }> = {
  route: { label: 'Route', description: 'Select execution strategy from risk / complexity' },
  evidence: { label: 'Evidence', description: 'Extract structured evidence from state' },
  candidates: { label: 'Candidates', description: 'Score bounded choices' },
  judge: { label: 'Judge', description: 'Propose a decision within choices' },
  critic: { label: 'Critic', description: 'Challenge uncertain / high-risk proposals' },
  confidence: { label: 'Confidence', description: 'Compose confidence (not authorization)' },
  policy: { label: 'Policy', description: 'Deterministic policy evaluation' },
  skillgate: { label: 'Skillgate', description: 'Classify capability risk floor' },
  hitl: { label: 'HITL', description: 'Human review when required' },
  execution: { label: 'Execution', description: 'Gatekeeper authorize + invoke capability' },
  complete: { label: 'Complete', description: 'Terminal / audit' },
};

/**
 * Project the decision pipeline as a portable Flow-shaped graph for the given strategy.
 */
export function projectDecisionFlow(input: ProjectDecisionFlowInput = {}): DecisionFlowProjection {
  const risk = input.risk ?? 'medium';
  const strategy = selectExecutionStrategy({
    risk,
    choiceCount: input.choiceCount ?? 4,
    strategy: input.strategy ?? 'auto',
    forceHumanRequired: input.forceHumanRequired,
  });
  const includeExecution = input.includeExecution !== false;
  const needEvidence = strategyIncludesEvidence(strategy);
  const needCandidates = strategyIncludesCandidates(strategy);
  const needCritic = strategyIncludesCritic(strategy);
  const needHitl = strategy === 'human-required' || risk === 'critical';

  const enabled = (id: DecisionFlowStageId): boolean => {
    switch (id) {
      case 'route':
      case 'judge':
      case 'confidence':
      case 'policy':
      case 'complete':
        return true;
      case 'evidence':
        return needEvidence;
      case 'candidates':
        return needCandidates;
      case 'critic':
        return needCritic;
      case 'skillgate':
      case 'execution':
        return includeExecution;
      case 'hitl':
        return needHitl;
      default:
        return false;
    }
  };

  const order: DecisionFlowStageId[] = [
    'route',
    'evidence',
    'candidates',
    'judge',
    'critic',
    'confidence',
    'policy',
    'skillgate',
    'hitl',
    'execution',
    'complete',
  ];

  const active = order.filter(enabled);
  const nodes: DecisionFlowNode[] = order.map((id) => ({
    id,
    label: STAGE_META[id].label,
    enabled: enabled(id),
    description: STAGE_META[id].description,
  }));

  const edges: DecisionFlowEdge[] = [];
  for (let i = 0; i < active.length - 1; i++) {
    const from = active[i]!;
    const to = active[i + 1]!;
    let when: string | undefined;
    if (from === 'policy' && to === 'skillgate') when = 'policy.allow';
    if (from === 'policy' && to === 'hitl') when = 'policy.review|escalate';
    if (from === 'hitl' && to === 'execution') when = 'human.approved';
    if (from === 'skillgate' && to === 'execution') when = 'gatekeeper.allow';
    edges.push({ from, to, when, priority: 0 });
  }

  // Parallel review branch: policy can skip to HITL when review/escalate
  if (
    enabled('hitl') &&
    enabled('policy') &&
    !edges.some((e) => e.from === 'policy' && e.to === 'hitl')
  ) {
    const policyIdx = active.indexOf('policy');
    if (policyIdx >= 0) {
      edges.push({
        from: 'policy',
        to: 'hitl',
        when: 'policy.review|escalate',
        priority: 1,
      });
    }
  }

  return {
    flowId: input.name ? `decision:${input.name}` : 'decision:pipeline',
    version: input.version ?? '1.0.0',
    entry: 'route',
    strategy,
    risk,
    nodes,
    edges,
  };
}

/**
 * Minimal FlowDefinition-compatible shape (handlers omitted / stubbed).
 * Register with `@hazeljs/flow` FlowEngine after attaching real handlers via
 * `attachDecisionFlowHandlers`.
 */
export interface DecisionFlowDefinitionStub {
  flowId: string;
  version: string;
  entry: string;
  nodes: Record<
    string,
    {
      id: string;
      name?: string;
      handler: (ctx: {
        input: unknown;
        state: Record<string, unknown>;
        outputs: Record<string, unknown>;
      }) => Promise<{ status: 'ok'; output?: unknown; patch?: Record<string, unknown> }>;
    }
  >;
  edges: Array<{
    from: string;
    to: string;
    when?: (ctx: { state: Record<string, unknown>; outputs: Record<string, unknown> }) => boolean;
    priority?: number;
  }>;
}

export type DecisionFlowStageHandler = (ctx: {
  stage: DecisionFlowStageId;
  input: unknown;
  state: Record<string, unknown>;
  outputs: Record<string, unknown>;
}) =>
  | Promise<{ status: 'ok'; output?: unknown; patch?: Record<string, unknown> }>
  | {
      status: 'ok';
      output?: unknown;
      patch?: Record<string, unknown>;
    };

/**
 * Build a FlowDefinition stub with pass-through handlers for enabled stages.
 * Hosts inject real stage work via `handlers` (e.g. call DecisionRuntime.decide).
 */
export function buildDecisionFlowDefinition(
  projection: DecisionFlowProjection,
  handlers?: Partial<Record<DecisionFlowStageId, DecisionFlowStageHandler>>
): DecisionFlowDefinitionStub {
  const nodes: DecisionFlowDefinitionStub['nodes'] = {};
  for (const node of projection.nodes.filter((n) => n.enabled)) {
    const custom = handlers?.[node.id];
    nodes[node.id] = {
      id: node.id,
      name: node.label,
      handler: async (
        ctx
      ): Promise<{
        status: 'ok';
        output?: unknown;
        patch?: Record<string, unknown>;
      }> => {
        if (custom) {
          return custom({
            stage: node.id,
            input: ctx.input,
            state: ctx.state,
            outputs: ctx.outputs,
          });
        }
        return {
          status: 'ok' as const,
          output: { stage: node.id, passthrough: true },
          patch: { lastStage: node.id },
        };
      },
    };
  }

  const edges = projection.edges
    .filter((e) => nodes[e.from] && nodes[e.to])
    .map((e) => ({
      from: e.from,
      to: e.to,
      priority: e.priority,
      when: e.when
        ? (ctx: { state: Record<string, unknown>; outputs: Record<string, unknown> }): boolean => {
            const policy = (ctx.outputs.policy ?? ctx.state.policy) as
              | { outcome?: string }
              | undefined;
            const hitl = (ctx.outputs.hitl ?? ctx.state.hitl) as { status?: string } | undefined;
            const gate = (ctx.outputs.skillgate ?? ctx.state.skillgate) as
              | { authorized?: boolean }
              | undefined;
            if (e.when === 'policy.allow') return policy?.outcome === 'allow';
            if (e.when === 'policy.review|escalate') {
              return policy?.outcome === 'review' || policy?.outcome === 'escalate';
            }
            if (e.when === 'human.approved') return hitl?.status === 'approved';
            if (e.when === 'gatekeeper.allow') return gate?.authorized === true;
            return true;
          }
        : undefined,
    }));

  return {
    flowId: projection.flowId,
    version: projection.version,
    entry: projection.entry,
    nodes,
    edges,
  };
}
