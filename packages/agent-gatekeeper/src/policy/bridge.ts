/**
 * Bridge from legacy @hazeljs/agent PolicyRule to AgentGatekeeperPolicy.
 */

import type { AgentGatekeeperPolicy } from '../types';

/** Minimal PolicyRule shape from @hazeljs/agent (avoid hard dependency). */
export interface PolicyRuleLike {
  id: string;
  tool: string;
  effect: 'allow' | 'deny' | 'mask' | 'require_approval';
  maskFields?: string[];
  reason?: string;
  whenInputIncludes?: string;
  priority?: number;
}

export function policiesFromPolicyRules(rules: PolicyRuleLike[]): AgentGatekeeperPolicy[] {
  return rules.map((rule) => {
    const policy: AgentGatekeeperPolicy = {
      id: rule.id,
      version: '1.0.0',
      priority: rule.priority ?? 0,
      match: {
        tools: rule.tool === '*' ? ['*'] : [rule.tool],
      },
    };

    if (rule.effect === 'deny') {
      policy.rules = {
        denyWhen: ({ input }): boolean => {
          if (!rule.whenInputIncludes) return true;
          return JSON.stringify(input).toLowerCase().includes(rule.whenInputIncludes.toLowerCase());
        },
      };
    } else if (rule.effect === 'require_approval') {
      policy.rules = {
        requireApprovalWhen: ({ input }): boolean => {
          if (!rule.whenInputIncludes) return true;
          return JSON.stringify(input).toLowerCase().includes(rule.whenInputIncludes.toLowerCase());
        },
      };
    } else if (rule.effect === 'mask') {
      policy.rules = {
        rewrite: ({ input }): unknown => {
          const out = { ...(input as Record<string, unknown>) };
          for (const field of rule.maskFields ?? []) {
            if (field in out) out[field] = '[REDACTED]';
          }
          return out as unknown;
        },
      };
    } else {
      policy.rules = {
        allowWhen: ({ input }): boolean => {
          if (!rule.whenInputIncludes) return true;
          return JSON.stringify(input).toLowerCase().includes(rule.whenInputIncludes.toLowerCase());
        },
      };
    }

    if (rule.reason) {
      const existingRules = policy.rules!;
      const wrap = <T extends (...args: never[]) => boolean>(
        fn: T | undefined,
        fallback: () => boolean
      ): (() => boolean) => {
        return () => {
          void rule.reason;
          return fn ? fn(...([] as never[])) : fallback();
        };
      };
      if (existingRules.denyWhen) {
        const orig = existingRules.denyWhen;
        existingRules.denyWhen = (ctx): boolean | Promise<boolean> => orig(ctx);
      }
      if (existingRules.allowWhen) {
        const orig = existingRules.allowWhen;
        existingRules.allowWhen = (ctx): boolean | Promise<boolean> => orig(ctx);
      }
      void wrap;
    }

    return policy;
  });
}

/** Extract Gatekeeper policies from Agent DNA policies array when shaped compatibly. */
export function policiesFromDna(dna: { policies?: unknown[] }): AgentGatekeeperPolicy[] {
  if (!dna.policies?.length) return [];
  const out: AgentGatekeeperPolicy[] = [];
  for (const raw of dna.policies) {
    if (raw && typeof raw === 'object' && 'id' in raw && 'version' in raw) {
      out.push(raw as AgentGatekeeperPolicy);
    } else if (raw && typeof raw === 'object' && 'id' in raw && 'effect' in raw) {
      out.push(...policiesFromPolicyRules([raw as PolicyRuleLike]));
    }
  }
  return out;
}

/**
 * Merge DNA-derived policies into a live list (same `id` replaces; new ids append).
 * Mutates `policies` in place for Gatekeeper bundle ownership.
 */
export function mergeDnaPolicies(
  policies: AgentGatekeeperPolicy[],
  dna: { policies?: unknown[] }
): void {
  const incoming = policiesFromDna(dna);
  for (const next of incoming) {
    const idx = policies.findIndex((p) => p.id === next.id);
    if (idx >= 0) policies[idx] = next;
    else policies.push(next);
  }
}
