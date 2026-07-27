/**
 * Agent OS Phase 2 — Declarative Policy Engine (allow / deny / mask / approval)
 */

export type PolicyEffect = 'allow' | 'deny' | 'mask' | 'require_approval';

export interface PolicyRule {
  id: string;
  /** Tool name or '*' */
  tool: string;
  effect: PolicyEffect;
  /** Optional field paths to mask when effect is mask (e.g. 'ssn', 'email'). */
  maskFields?: string[];
  /** Optional reason shown in audits / HITL. */
  reason?: string;
  /** Match when input JSON string includes this (case-insensitive). */
  whenInputIncludes?: string;
  /** Higher wins when multiple rules match (default 0). */
  priority?: number;
}

export interface PolicyDecision {
  effect: PolicyEffect;
  ruleId?: string;
  reason?: string;
  /** Input after masking (when effect is mask or allow with masks). */
  input: Record<string, unknown>;
  allowed: boolean;
  requiresApproval: boolean;
}

function maskValue(v: unknown): unknown {
  if (typeof v === 'string') return '[REDACTED]';
  if (typeof v === 'number') return 0;
  if (Array.isArray(v)) return v.map(maskValue);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = maskValue(val);
    }
    return out;
  }
  return null;
}

function applyMasks(input: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out = { ...input };
  for (const field of fields) {
    if (field.includes('.')) {
      const [head, ...rest] = field.split('.');
      if (out[head] && typeof out[head] === 'object') {
        out[head] = applyMasks(out[head] as Record<string, unknown>, [rest.join('.')]);
      }
    } else if (field in out) {
      out[field] = maskValue(out[field]);
    }
  }
  return out;
}

export class PolicyEngine {
  constructor(private rules: PolicyRule[] = []) {}

  setRules(rules: PolicyRule[]): void {
    this.rules = rules;
  }

  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
  }

  evaluate(toolName: string, input: Record<string, unknown>): PolicyDecision {
    const inputStr = JSON.stringify(input).toLowerCase();
    const matched = this.rules
      .filter((r) => r.tool === '*' || r.tool === toolName)
      .filter((r) => !r.whenInputIncludes || inputStr.includes(r.whenInputIncludes.toLowerCase()))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    if (matched.length === 0) {
      return { effect: 'allow', input, allowed: true, requiresApproval: false };
    }

    const top = matched[0];
    let nextInput = input;

    if (top.effect === 'mask' || (top.effect === 'allow' && top.maskFields?.length)) {
      nextInput = applyMasks(input, top.maskFields ?? []);
    }

    if (top.effect === 'deny') {
      return {
        effect: 'deny',
        ruleId: top.id,
        reason: top.reason ?? `Denied by policy ${top.id}`,
        input: nextInput,
        allowed: false,
        requiresApproval: false,
      };
    }

    if (top.effect === 'require_approval') {
      return {
        effect: 'require_approval',
        ruleId: top.id,
        reason: top.reason ?? `Approval required by policy ${top.id}`,
        input: nextInput,
        allowed: true,
        requiresApproval: true,
      };
    }

    if (top.effect === 'mask') {
      return {
        effect: 'mask',
        ruleId: top.id,
        reason: top.reason,
        input: nextInput,
        allowed: true,
        requiresApproval: false,
      };
    }

    return {
      effect: 'allow',
      ruleId: top.id,
      reason: top.reason,
      input: nextInput,
      allowed: true,
      requiresApproval: false,
    };
  }
}

/** Default safe policies: mask common PII fields on any tool. */
export function defaultPiiMaskPolicies(): PolicyRule[] {
  return [
    {
      id: 'mask-pii',
      tool: '*',
      effect: 'mask',
      maskFields: ['ssn', 'password', 'apiKey', 'secret', 'creditCard'],
      priority: 1,
      reason: 'Mask sensitive fields',
    },
  ];
}
