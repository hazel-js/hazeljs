/**
 * Governance — Gatekeeper authorization + Skillgate risk-floor (never lowers risk).
 * AI confidence is never permission.
 */

import type { AgentGatekeeper, ToolInvocationContext } from '@hazeljs/agent-gatekeeper';
import type { DecisionRiskLevel } from '../types';
import { raiseRiskFloor } from '../utils';

export type SkillClass = 'read' | 'write' | 'destructive' | 'admin';

export interface GovernedSkillLike {
  name: string;
  class: SkillClass;
  denied?: boolean;
}

export interface SkillgateLookup {
  findByName?(name: string): GovernedSkillLike | undefined;
  list?(): GovernedSkillLike[];
}

export function skillClassToRiskFloor(skillClass: SkillClass): DecisionRiskLevel {
  switch (skillClass) {
    case 'read':
      return 'low';
    case 'write':
      return 'medium';
    case 'destructive':
      return 'high';
    case 'admin':
      return 'critical';
    default:
      return 'medium';
  }
}

export function applySkillgateRiskFloor(
  current: DecisionRiskLevel,
  skill: GovernedSkillLike | undefined
): DecisionRiskLevel {
  if (!skill) return current;
  return raiseRiskFloor(current, skillClassToRiskFloor(skill.class));
}

export function lookupSkill(
  skillgate: SkillgateLookup | undefined,
  capability: string | undefined
): GovernedSkillLike | undefined {
  if (!skillgate || !capability) return undefined;
  if (skillgate.findByName) return skillgate.findByName(capability);
  const list = skillgate.list?.() ?? [];
  return list.find((s) => s.name === capability || `skillgate.${s.class}.${s.name}` === capability);
}

export interface AuthorizeCapabilityInput {
  gatekeeper?: AgentGatekeeper;
  decisionId: string;
  runId: string;
  agentId: string;
  tenantId?: string;
  capability: string;
  environment?: string;
  input?: Record<string, unknown>;
  classification?: 'read' | 'write' | 'destructive';
}

export interface AuthorizeCapabilityResult {
  authorized: boolean;
  outcome: 'allow' | 'deny' | 'require_approval' | 'rewrite' | 'skipped';
  reason?: string;
  code?: string;
}

export async function authorizeCapability(
  input: AuthorizeCapabilityInput
): Promise<AuthorizeCapabilityResult> {
  if (!input.gatekeeper) {
    // Without a gatekeeper, execution must not proceed when requested.
    return {
      authorized: false,
      outcome: 'deny',
      reason: 'No Gatekeeper configured — execution denied by default',
      code: 'GATEKEEPER_MISSING',
    };
  }

  const context: ToolInvocationContext = {
    invocationId: `inv_${input.decisionId}`,
    runId: input.runId,
    agentId: input.agentId,
    tenantId: input.tenantId,
    toolName: input.capability,
    input: input.input ?? {},
    environment: input.environment ?? 'production',
    timestamp: new Date(),
    idempotencyKey: `${input.decisionId}:${input.capability}`,
  };

  const decision = await input.gatekeeper.evaluate(context, input.classification);
  if (decision.outcome === 'allow') {
    return { authorized: true, outcome: 'allow', reason: decision.reason };
  }
  if (decision.outcome === 'deny') {
    return {
      authorized: false,
      outcome: 'deny',
      reason: decision.reason,
      code: decision.code,
    };
  }
  if (decision.outcome === 'require_approval') {
    return {
      authorized: false,
      outcome: 'require_approval',
      reason: decision.reason,
    };
  }
  return {
    authorized: false,
    outcome: 'rewrite',
    reason: decision.reason,
  };
}
