/**
 * Model allowlist for AI calls (prod only)
 */

import type { Policy, PolicyContext, PolicyResult } from '../policyEngine';
import type { HazelEvent } from '@hazeljs/contracts';

export interface ModelAllowlistConfig {
  allowedModels: string[];
  /** If true, deny unknown models. Default true for prod. */
  strict?: boolean;
}

export function modelAllowlist(config: ModelAllowlistConfig): Policy {
  const { allowedModels, strict = true } = config;
  return {
    name: 'modelAllowlist',
    phase: 'onEvent',
    evaluate(ctx: PolicyContext & { event: HazelEvent }): PolicyResult {
      const ev = ctx.event;
      if (ev.type !== 'aiCall') return { policy: 'modelAllowlist', result: 'ALLOW' };
      const model = (ev as { model: string }).model;
      if (allowedModels.includes(model)) {
        return { policy: 'modelAllowlist', result: 'ALLOW' };
      }
      if (strict) {
        return {
          policy: 'modelAllowlist',
          result: 'DENY',
          message: `Model ${model} not in allowlist`,
        };
      }
      return { policy: 'modelAllowlist', result: 'ALLOW' };
    },
  };
}
