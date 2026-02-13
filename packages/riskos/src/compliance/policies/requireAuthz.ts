/**
 * Require actor authorization (basic role check)
 */

import type { Policy, PolicyContext, PolicyResult } from '../policyEngine';

export interface RequireAuthzConfig {
  allowedRoles?: string[];
}

export function requireAuthz(config?: RequireAuthzConfig): Policy {
  const allowedRoles = config?.allowedRoles ?? ['admin', 'analyst', 'investigator'];
  return {
    name: 'requireAuthz',
    phase: 'before',
    evaluate(ctx: PolicyContext): PolicyResult {
      if (!ctx.actor?.role) {
        return {
          policy: 'requireAuthz',
          result: 'DENY',
          message: 'actor.role is required',
        };
      }
      if (allowedRoles.includes(ctx.actor.role)) {
        return { policy: 'requireAuthz', result: 'ALLOW' };
      }
      return {
        policy: 'requireAuthz',
        result: 'DENY',
        message: `role ${ctx.actor.role} not in allowlist`,
      };
    },
  };
}
