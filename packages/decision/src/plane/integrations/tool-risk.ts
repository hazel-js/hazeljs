/**
 * Tool-risk classification — advisory only.
 * May raise risk treatment; never grants a permission the caller lacks.
 * Pass the resulting classification into AgentGatekeeper.evaluate before execute.
 */

import { defineDecision, type DecisionDefinition } from '../definition';
import type { DecisionPlane } from '../service';
import type { PlaneExecutionContext, PlaneResult } from '../result';
import { createRulesPlaneProvider } from '../providers';

export const TOOL_RISK_ANSWERS = ['read', 'write', 'destructive', 'abstain'] as const;
export type ToolRiskAnswer = (typeof TOOL_RISK_ANSWERS)[number];

/** Maps to Gatekeeper ToolClassification when not abstain. */
export type GatekeeperToolClassification = 'read' | 'write' | 'destructive';

export interface ToolRiskContext {
  toolName: string;
  /** Trusted server-side hints (not model-supplied identity). */
  mutates?: boolean;
  financial?: boolean;
  deletes?: boolean;
  admin?: boolean;
}

export function createToolRiskDefinition(): DecisionDefinition<typeof TOOL_RISK_ANSWERS> {
  return defineDecision({
    id: 'governance.tool-risk',
    version: '1',
    domain: 'governance',
    description: 'Classify tool risk before Gatekeeper evaluation',
    answers: TOOL_RISK_ANSWERS,
    criteria: {
      read: 'Read-only lookup with no side effects',
      write: 'Creates or updates business state',
      destructive: 'Deletes, refunds, or irreversible financial action',
      abstain: 'Insufficient signal; treat as write or require review',
    },
    timeoutMs: 500,
    strategy: { providers: ['tool-risk-rules'], onFailure: 'abstain', maxRetries: 0 },
    cache: { enabled: false },
    securityCritical: true,
  });
}

export function createToolRiskRulesProvider() {
  return createRulesPlaneProvider<ToolRiskAnswer>({
    name: 'tool-risk-rules',
    rules: [
      {
        answer: 'destructive',
        when: (ctx) => {
          const c = ctx as ToolRiskContext;
          return !!(
            c.deletes ||
            c.financial ||
            c.admin ||
            /refund|delete|cancel|destroy/i.test(c.toolName)
          );
        },
        summary: 'Financial, delete, or admin tool.',
      },
      {
        answer: 'write',
        when: (ctx) => {
          const c = ctx as ToolRiskContext;
          return !!(c.mutates || /create|update|write|set|post/i.test(c.toolName));
        },
        summary: 'Mutating tool.',
      },
      {
        answer: 'read',
        when: (ctx) => {
          const c = ctx as ToolRiskContext;
          return !c.mutates && !c.financial && !c.deletes;
        },
        summary: 'Read-only tool.',
      },
    ],
    onNoMatch: 'abstain',
  });
}

export interface ToolRiskClassification {
  result: PlaneResult<ToolRiskAnswer>;
  /** Classification for Gatekeeper.evaluate; undefined when abstained → treat as write. */
  classification: GatekeeperToolClassification;
  /** Advisory only — Gatekeeper still decides allow/deny. */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export async function classifyToolRisk(
  plane: DecisionPlane,
  input: {
    context: ToolRiskContext;
    execution: PlaneExecutionContext;
    definition?: DecisionDefinition<typeof TOOL_RISK_ANSWERS>;
  }
): Promise<ToolRiskClassification> {
  const definition = input.definition ?? createToolRiskDefinition();
  const result = await plane.decide({
    definition,
    context: input.context,
    execution: input.execution,
  });

  let classification: GatekeeperToolClassification = 'write';
  let riskLevel: ToolRiskClassification['riskLevel'] = 'medium';

  if (result.status === 'succeeded') {
    if (result.answer === 'read') {
      classification = 'read';
      riskLevel = 'low';
    } else if (result.answer === 'write') {
      classification = 'write';
      riskLevel = 'medium';
    } else if (result.answer === 'destructive') {
      classification = 'destructive';
      riskLevel = 'critical';
    } else {
      classification = 'write';
      riskLevel = 'high';
    }
  } else {
    classification = 'write';
    riskLevel = 'high';
  }

  return { result: result as PlaneResult<ToolRiskAnswer>, classification, riskLevel };
}
