/**
 * Approval gate - if decision score above threshold => REVIEW
 */

import type { Policy, PolicyContext, PolicyResult } from '../policyEngine';
import type { HazelEvent } from '@hazeljs/contracts';
import { DecisionStatus } from '@hazeljs/contracts';

export interface ApprovalGateConfig {
  reviewThreshold?: number;
}

export function approvalGate(config?: ApprovalGateConfig): Policy {
  const threshold = config?.reviewThreshold ?? 70;
  return {
    name: 'approvalGate',
    phase: 'onEvent',
    evaluate(ctx: PolicyContext & { event: HazelEvent }): PolicyResult {
      const ev = ctx.event;
      if (ev.type !== 'decision') return { policy: 'approvalGate', result: 'ALLOW' };
      const dec = ev as { score?: number; status?: DecisionStatus };
      if (dec.score != null && dec.score >= threshold && dec.status !== 'REVIEW') {
        return {
          policy: 'approvalGate',
          result: 'TRANSFORM',
          transformed: { ...ev, status: DecisionStatus.REVIEW } as HazelEvent,
        };
      }
      return { policy: 'approvalGate', result: 'ALLOW' };
    },
  };
}
