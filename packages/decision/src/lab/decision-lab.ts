/**
 * Decision Lab — backend API for visualizing / comparing decision runs.
 * Comparison and lab runs never execute capabilities (shadow-safe).
 */

import type { DecisionRequest, DecisionLabRun, DecisionResult } from '../types';
import type { DecisionRuntime } from '../runtime/decision-runtime';
import { buildAuditEvent } from '../observability/metrics';
import { DecisionValidationError } from '../errors';
import {
  projectDecisionFlow,
  type DecisionFlowProjection,
  type ProjectDecisionFlowInput,
} from '../flow/decision-flow';

export interface DecisionLabCompareRow {
  provider: string;
  decision?: string;
  confidence?: number;
  latencyMs?: number;
  cost?: DecisionResult['cost'];
  strategy?: string;
  policy?: string;
  error?: string;
  labRun?: DecisionLabRun;
}

export interface DecisionLabComparison {
  objective: string;
  name?: string;
  choices: string[];
  agreement: boolean;
  majorityDecision?: string;
  rows: DecisionLabCompareRow[];
  /** Always true — comparison mode never executes actions. */
  executionForbidden: true;
}

export interface DecisionLabGraphNode {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'failed';
  durationMs?: number;
  detail?: string;
}

export function enrichLabRun(result: DecisionResult): DecisionLabRun {
  const latency = result.latency;
  const stages: DecisionLabRun['stages'] = [];
  const push = (name: string, durationMs?: number, output?: unknown): void => {
    if (durationMs === undefined && !result.provenance.stages.includes(name)) return;
    stages.push({ name, durationMs: durationMs ?? 0, output });
  };

  push('route', 0, { strategy: result.strategy, risk: result.risk.level });
  push('evidence', latency.evidenceMs, result.evidence);
  push('candidates', latency.candidatesMs, result.candidates);
  push('judge', latency.judgeMs, { decision: result.decision, confidence: result.confidence });
  if (result.critic) push('critic', latency.criticMs, result.critic);
  push('confidence', latency.confidenceMs, result.confidenceDetail);
  push('policy', latency.policyMs, result.policy);
  if (result.execution?.capability) {
    push('skillgate', latency.skillgateMs, result.execution);
  }

  return {
    result,
    stages:
      stages.length > 0
        ? stages
        : result.provenance.stages.map((name) => ({ name, durationMs: 0 })),
    audit: buildAuditEvent(result),
  };
}

export function toLabGraph(lab: DecisionLabRun): DecisionLabGraphNode[] {
  const done = new Set(lab.stages.map((s) => s.name));
  const order = [
    'route',
    'evidence',
    'candidates',
    'judge',
    'critic',
    'confidence',
    'policy',
    'skillgate',
    'execution',
  ];
  return order.map((id) => {
    const stage = lab.stages.find((s) => s.name === id || s.name.startsWith(id));
    if (stage) {
      return {
        id,
        label: id,
        status: 'done' as const,
        durationMs: stage.durationMs,
        detail:
          typeof stage.output === 'object' && stage.output
            ? JSON.stringify(stage.output).slice(0, 160)
            : undefined,
      };
    }
    if (id === 'critic' && !lab.result.critic) {
      return { id, label: id, status: 'skipped' as const };
    }
    if (id === 'execution') {
      return {
        id,
        label: id,
        status: lab.result.execution?.invoked
          ? 'done'
          : lab.result.execution?.authorized === false
            ? 'failed'
            : 'skipped',
        detail: lab.result.execution
          ? `authorized=${String(lab.result.execution.authorized)} invoked=${String(lab.result.execution.invoked)}`
          : 'not requested',
      };
    }
    if (id === 'skillgate' && !lab.result.execution?.capability) {
      return { id, label: id, status: 'skipped' as const };
    }
    return {
      id,
      label: id,
      status: done.size ? ('skipped' as const) : ('pending' as const),
    };
  });
}

export class DecisionLab {
  constructor(private readonly runtime: DecisionRuntime) {}

  listProviders(): string[] {
    return this.runtime.providers.list();
  }

  /**
   * Run a decision for visualization. Execution is forced off unless explicitly allowed
   * via `allowExecution: true` (still subject to Gatekeeper).
   */
  async run(
    request: DecisionRequest,
    options?: { allowExecution?: boolean }
  ): Promise<DecisionLabRun & { graph: DecisionLabGraphNode[] }> {
    const result = await this.runtime.decide({
      ...request,
      execute: options?.allowExecution === true ? request.execute : false,
      metadata: {
        ...(request.metadata ?? {}),
        decisionLab: true,
      },
    });
    const lab = enrichLabRun(result as DecisionResult);
    return { ...lab, graph: toLabGraph(lab) };
  }

  /**
   * Shadow-compare providers on the same input. Never executes capabilities.
   */
  async compare(request: DecisionRequest, providers: string[]): Promise<DecisionLabComparison> {
    if (!providers.length) {
      throw new DecisionValidationError('compare requires at least one provider');
    }
    const rows: DecisionLabCompareRow[] = [];

    for (const provider of providers) {
      try {
        if (!this.runtime.providers.has(provider)) {
          rows.push({ provider, error: `Provider not registered: ${provider}` });
          continue;
        }
        const result = await this.runtime.decide({
          ...request,
          provider,
          execute: false,
          metadata: {
            ...(request.metadata ?? {}),
            decisionLab: true,
            shadow: true,
          },
        });
        const lab = enrichLabRun(result as DecisionResult);
        rows.push({
          provider,
          decision: String(result.decision),
          confidence: result.confidence,
          latencyMs: result.latency.totalMs,
          cost: result.cost,
          strategy: result.strategy,
          policy: result.policy.outcome,
          labRun: lab,
        });
      } catch (e) {
        rows.push({
          provider,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const decisions = rows.map((r) => r.decision).filter((d): d is string => typeof d === 'string');
    const counts = new Map<string, number>();
    for (const d of decisions) counts.set(d, (counts.get(d) ?? 0) + 1);
    let majorityDecision: string | undefined;
    let best = 0;
    for (const [d, n] of counts) {
      if (n > best) {
        best = n;
        majorityDecision = d;
      }
    }
    const agreement = decisions.length > 0 && decisions.every((d) => d === decisions[0]);

    return {
      objective: request.objective,
      name: request.name,
      choices: [...request.choices],
      agreement,
      majorityDecision,
      rows,
      executionForbidden: true,
    };
  }

  async replay(
    runId: string
  ): Promise<(DecisionLabRun & { graph: DecisionLabGraphNode[] }) | undefined> {
    const lab = await this.runtime.replay(runId);
    if (!lab) return undefined;
    return { ...lab, graph: toLabGraph(lab) };
  }

  /** Project pipeline stages for the given risk/strategy (no execution). */
  projectFlow(input?: ProjectDecisionFlowInput): DecisionFlowProjection {
    return projectDecisionFlow(input);
  }
}

export function createDecisionLab(runtime: DecisionRuntime): DecisionLab {
  return new DecisionLab(runtime);
}
