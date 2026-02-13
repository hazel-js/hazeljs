/**
 * Require tenantId for actions
 */

import type { Policy, PolicyContext, PolicyResult } from '../policyEngine';

export function requireTenant(): Policy {
  return {
    name: 'requireTenant',
    phase: 'before',
    evaluate(ctx: PolicyContext): PolicyResult {
      if (ctx.tenantId) {
        return { policy: 'requireTenant', result: 'ALLOW' };
      }
      return {
        policy: 'requireTenant',
        result: 'DENY',
        message: 'tenantId is required',
      };
    },
  };
}
