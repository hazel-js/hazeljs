/**
 * Policy evaluation engine — deterministic, precedence-based.
 */

import { GatekeeperErrorCodes } from '../errors';
import { BudgetTracker } from '../budget/tracker';
import { canonicalJson, matchToolPattern, redactObject, safeClone, stripFields } from '../security';
import type {
  AgentGatekeeperPolicy,
  DefaultDecision,
  GatekeeperDecision,
  GatekeeperMode,
  PolicyEvaluationContext,
  ToolClassification,
  ToolInvocationContext,
} from '../types';

export type PolicyOutcomeKind = 'deny' | 'require_approval' | 'rewrite' | 'allow' | 'none';

export interface PolicyMatchResult<TInput = unknown> {
  policy: AgentGatekeeperPolicy<TInput>;
  outcome: PolicyOutcomeKind;
  reason?: string;
  safeInput?: TInput;
}

export interface EvaluatePoliciesOptions<TInput = unknown> {
  policies: AgentGatekeeperPolicy<TInput>[];
  evalCtx: PolicyEvaluationContext<TInput>;
  mode: GatekeeperMode;
  defaultDecision: DefaultDecision;
  budgetTracker: BudgetTracker;
  nowMs: number;
  policyTimeoutMs: number;
  rewritePass: number;
  maxRewritePasses: number;
}

export interface EvaluatePoliciesResult<TInput = unknown> {
  decision: GatekeeperDecision<TInput>;
  matchedPolicies: Array<{ id: string; version: string; priority: number }>;
  explanation: string[];
}

function inTimeWindow(now: Date, windows: import('../types').TimeWindow[] | undefined): boolean {
  if (!windows?.length) return true;
  const day = now.getUTCDay();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return windows.some((w) => {
    if (w.days !== '*' && w.days?.length && !w.days.includes(day)) return false;
    if (w.start && w.end) {
      const [sh, sm] = w.start.split(':').map(Number);
      const [eh, em] = w.end.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      if (minutes < startMin || minutes > endMin) return false;
    }
    return true;
  });
}

function policyMatches<TInput>(
  policy: AgentGatekeeperPolicy<TInput>,
  ctx: ToolInvocationContext<TInput>,
  classification?: ToolClassification
): boolean {
  const m = policy.match;
  if (!m) return true;
  if (m.agents?.length && !m.agents.includes(ctx.agentId)) return false;
  if (m.agentVersions?.length && ctx.agentVersion && !m.agentVersions.includes(ctx.agentVersion))
    return false;
  if (m.roles?.length && ctx.roles?.length) {
    if (!m.roles.some((r) => ctx.roles!.includes(r))) return false;
  } else if (m.roles?.length && !ctx.roles?.length) {
    return false;
  }
  if (m.trustLevels?.length && ctx.trustLevel && !m.trustLevels.includes(ctx.trustLevel))
    return false;
  if (m.tenants?.length && ctx.tenantId && !m.tenants.includes(ctx.tenantId)) return false;
  if (
    m.delegatedUsers?.length &&
    ctx.delegatedUserId &&
    !m.delegatedUsers.includes(ctx.delegatedUserId)
  )
    return false;
  if (m.tools?.length && !m.tools.some((t) => matchToolPattern(ctx.toolName, t))) return false;
  if (m.environments?.length && !m.environments.includes(ctx.environment)) return false;
  if (m.classifications?.length && classification && !m.classifications.includes(classification))
    return false;
  if (!inTimeWindow(ctx.timestamp, m.timeWindows)) return false;
  return true;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Policy evaluation timed out: ${label}`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function evaluatePolicyRules<TInput>(
  policy: AgentGatekeeperPolicy<TInput>,
  evalCtx: PolicyEvaluationContext<TInput>,
  budgetTracker: BudgetTracker,
  nowMs: number,
  rewritePass: number
): Promise<PolicyMatchResult<TInput> | null> {
  const rules = policy.rules;
  if (!rules) return null;

  const inputObj = evalCtx.input as Record<string, unknown>;

  if (rules.enforceTenantField && evalCtx.context.tenantId) {
    const fieldVal = inputObj[rules.enforceTenantField];
    if (fieldVal !== undefined && fieldVal !== evalCtx.context.tenantId) {
      return {
        policy,
        outcome: 'deny',
        reason: `Tenant field "${rules.enforceTenantField}" does not match trusted tenant`,
      };
    }
  }

  if (rules.maxTransactionAmount != null && typeof inputObj.amount === 'number') {
    if (inputObj.amount > rules.maxTransactionAmount) {
      return {
        policy,
        outcome: 'deny',
        reason: `Transaction amount exceeds limit of ${rules.maxTransactionAmount}`,
      };
    }
  }

  if (rules.rateLimit) {
    const result = await budgetTracker.checkRateLimit(
      {
        scope: 'rate',
        policyId: policy.id,
        runId: evalCtx.context.runId,
        tenantId: evalCtx.context.tenantId,
      },
      rules.rateLimit.max,
      rules.rateLimit.windowMs,
      nowMs
    );
    if (!result.allowed) {
      return { policy, outcome: 'deny', reason: 'Rate limit exceeded' };
    }
  }

  if (rules.costBudget && evalCtx.context.metadata?.estimatedCostUnits) {
    const units = Number(evalCtx.context.metadata.estimatedCostUnits) || 0;
    const result = await budgetTracker.checkCostBudget(
      { scope: 'cost', policyId: policy.id, tenantId: evalCtx.context.tenantId },
      units,
      rules.costBudget.maxUnits,
      rules.costBudget.windowMs,
      nowMs
    );
    if (!result.allowed) {
      return { policy, outcome: 'deny', reason: 'Cost budget exceeded' };
    }
  }

  if (rules.invocationBudget) {
    const result = await budgetTracker.checkInvocationBudget(
      evalCtx.context.runId,
      policy.id,
      rules.invocationBudget.max
    );
    if (!result.allowed) {
      return { policy, outcome: 'deny', reason: 'Invocation budget exceeded for run' };
    }
  }

  if (rules.denyWhen && (await rules.denyWhen(evalCtx))) {
    return { policy, outcome: 'deny', reason: `Denied by policy ${policy.id}` };
  }

  if (rules.requireApprovalWhen && (await rules.requireApprovalWhen(evalCtx))) {
    return {
      policy,
      outcome: 'require_approval',
      reason: `Approval required by policy ${policy.id}`,
    };
  }

  if (rules.rewrite && rewritePass === 0) {
    let rewritten: TInput = await rules.rewrite(evalCtx);
    if (rules.stripFields?.length) {
      rewritten = stripFields(
        rewritten as Record<string, unknown>,
        rules.stripFields
      ) as unknown as TInput;
    }
    return {
      policy,
      outcome: 'rewrite',
      reason: `Input rewritten by policy ${policy.id}`,
      safeInput: rewritten,
    };
  }

  if (rules.allowWhen) {
    if (await rules.allowWhen(evalCtx)) {
      return { policy, outcome: 'allow', reason: `Allowed by policy ${policy.id}` };
    }
    return { policy, outcome: 'deny', reason: `Allow predicate failed for policy ${policy.id}` };
  }

  return null;
}

const OUTCOME_PRECEDENCE: Record<PolicyOutcomeKind, number> = {
  deny: 4,
  require_approval: 3,
  rewrite: 2,
  allow: 1,
  none: 0,
};

export async function evaluatePolicies<TInput = unknown>(
  options: EvaluatePoliciesOptions<TInput>
): Promise<EvaluatePoliciesResult<TInput>> {
  const {
    policies,
    evalCtx,
    mode,
    defaultDecision,
    budgetTracker,
    nowMs,
    policyTimeoutMs,
    rewritePass,
    maxRewritePasses,
  } = options;

  const explanation: string[] = [];
  const matchedPolicies: Array<{ id: string; version: string; priority: number }> = [];

  if (mode === 'disabled') {
    explanation.push('Gatekeeper disabled — bypassing policy evaluation');
    return {
      decision: { outcome: 'allow', policyIds: [], reason: 'Gatekeeper disabled' },
      matchedPolicies,
      explanation,
    };
  }

  const applicable = policies
    .filter((p) => policyMatches(p, evalCtx.context, evalCtx.classification))
    .sort((a, b) => {
      const pd = (b.priority ?? 0) - (a.priority ?? 0);
      if (pd !== 0) return pd;
      return a.id.localeCompare(b.id);
    });

  explanation.push(`Matched ${applicable.length} applicable policies`);

  const results: PolicyMatchResult<TInput>[] = [];

  for (const policy of applicable) {
    matchedPolicies.push({
      id: policy.id,
      version: policy.version,
      priority: policy.priority ?? 0,
    });
    try {
      const rules = policy.rules;
      let result: PolicyMatchResult<TInput> | null = null;
      if (rules) {
        result = await withTimeout(
          evaluatePolicyRules(policy, evalCtx, budgetTracker, nowMs, rewritePass),
          policyTimeoutMs,
          policy.id
        );
      }
      if (result) {
        results.push(result);
        explanation.push(`Policy ${policy.id} → ${result.outcome}: ${result.reason ?? ''}`);
      }
    } catch {
      explanation.push(`Policy ${policy.id} evaluation failed`);
      if (mode === 'enforce') {
        return {
          decision: {
            outcome: 'deny',
            policyIds: [policy.id],
            reason: 'Policy evaluation failed',
            code: GatekeeperErrorCodes.POLICY,
          },
          matchedPolicies,
          explanation,
        };
      }
    }
  }

  if (results.length === 0) {
    if (defaultDecision === 'deny') {
      explanation.push('No applicable allow policy — default deny');
      return {
        decision: {
          outcome: 'deny',
          policyIds: [],
          reason: 'No applicable allow policy',
          code: GatekeeperErrorCodes.DEFAULT_DENY,
        },
        matchedPolicies,
        explanation,
      };
    }
    explanation.push('No policies matched — default allow');
    return {
      decision: { outcome: 'allow', policyIds: [], reason: 'Default allow' },
      matchedPolicies,
      explanation,
    };
  }

  results.sort((a, b) => {
    const pa = OUTCOME_PRECEDENCE[a.outcome] - OUTCOME_PRECEDENCE[b.outcome];
    if (pa !== 0) return pa;
    const pp = (b.policy.priority ?? 0) - (a.policy.priority ?? 0);
    if (pp !== 0) return pp;
    return a.policy.id.localeCompare(b.policy.id);
  });

  const top = results[results.length - 1];
  const policyIds = [top.policy.id];

  if (top.outcome === 'deny') {
    return {
      decision: {
        outcome: 'deny',
        policyIds,
        reason: top.reason ?? 'Denied by policy',
        code: GatekeeperErrorCodes.DENIED,
      },
      matchedPolicies,
      explanation,
    };
  }

  if (top.outcome === 'require_approval') {
    if (mode === 'audit') {
      explanation.push('Audit mode — would require approval but continuing');
      return {
        decision: { outcome: 'allow', policyIds, reason: 'Audit mode override' },
        matchedPolicies,
        explanation,
      };
    }
    // Approval request built by AgentGatekeeper with provider
    return {
      decision: {
        outcome: 'require_approval',
        policyIds,
        reason: top.reason ?? 'Approval required',
        approvalRequest: null as unknown as import('../types').ApprovalRequest,
      },
      matchedPolicies,
      explanation,
    };
  }

  if (top.outcome === 'rewrite') {
    if (rewritePass >= maxRewritePasses) {
      explanation.push('Rewrite limit exceeded');
      return {
        decision: {
          outcome: 'deny',
          policyIds,
          reason: 'Rewrite limit exceeded',
          code: GatekeeperErrorCodes.REWRITE_LIMIT,
        },
        matchedPolicies,
        explanation,
      };
    }
    return {
      decision: {
        outcome: 'rewrite',
        policyIds,
        reason: top.reason ?? 'Input rewritten',
        safeInput: top.safeInput as TInput,
      },
      matchedPolicies,
      explanation,
    };
  }

  return {
    decision: {
      outcome: 'allow',
      policyIds,
      reason: top.reason,
    },
    matchedPolicies,
    explanation,
  };
}

export function buildArgumentSummary<TInput>(
  input: TInput,
  redactFields: string[] = []
): Record<string, unknown> {
  if (input && typeof input === 'object') {
    return redactObject(input as Record<string, unknown>, redactFields);
  }
  return { value: input };
}

export { safeClone, canonicalJson };
