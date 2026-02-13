/**
 * Require sources for AI calls - deny if aiCall without sources
 */

import type { Policy, PolicyContext, PolicyResult } from '../policyEngine';
import type { HazelEvent } from '@hazeljs/contracts';

export function requireSourcesForAI(): Policy {
  return {
    name: 'requireSourcesForAI',
    phase: 'onEvent',
    evaluate(ctx: PolicyContext & { event: HazelEvent }): PolicyResult {
      const ev = ctx.event;
      if (ev.type !== 'aiCall') return { policy: 'requireSourcesForAI', result: 'ALLOW' };
      const aiEv = ev as { sources?: string[] };
      if (aiEv.sources && aiEv.sources.length > 0) {
        return { policy: 'requireSourcesForAI', result: 'ALLOW' };
      }
      return {
        policy: 'requireSourcesForAI',
        result: 'DENY',
        message: 'AI call must include sources for auditability',
      };
    },
  };
}
