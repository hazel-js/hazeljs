/**
 * Require purpose string for sensitive actions (investigation/aml/kyc)
 */

import type { Policy, PolicyContext, PolicyResult } from '../policyEngine';

export interface RequirePurposeConfig {
  actions?: string[];
}

const DEFAULT_SENSITIVE_ACTIONS = ['investigation', 'aml', 'kyc', 'kyb', 'onboarding'];

export function requirePurpose(config?: RequirePurposeConfig): Policy {
  const actions = config?.actions ?? DEFAULT_SENSITIVE_ACTIONS;
  return {
    name: 'requirePurpose',
    phase: 'before',
    evaluate(ctx: PolicyContext): PolicyResult {
      const action = ctx.actionName?.toLowerCase() ?? '';
      const isSensitive = actions.some(a => action.includes(a));
      if (!isSensitive) return { policy: 'requirePurpose', result: 'ALLOW' };
      if (ctx.purpose && typeof ctx.purpose === 'string' && ctx.purpose.length > 0) {
        return { policy: 'requirePurpose', result: 'ALLOW' };
      }
      return {
        policy: 'requirePurpose',
        result: 'DENY',
        message: 'purpose is required for this action',
      };
    },
  };
}
