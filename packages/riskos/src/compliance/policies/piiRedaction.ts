/**
 * PII redaction policy - redact event payload before storing
 */

import type { Policy, PolicyContext, PolicyResult } from '../policyEngine';
import type { HazelEvent } from '@hazeljs/contracts';
import { redactPiiDeep } from '../../utils/redact';

export function piiRedaction(fields?: string[]): Policy {
  return {
    name: 'piiRedaction',
    phase: 'onEvent',
    evaluate(ctx: PolicyContext & { event: HazelEvent }): PolicyResult {
      const ev = ctx.event as unknown as Record<string, unknown>;
      if (!ev.payload || typeof ev.payload !== 'object') {
        return { policy: 'piiRedaction', result: 'ALLOW' };
      }
      const redacted = redactPiiDeep(ev.payload, fields);
      return {
        policy: 'piiRedaction',
        result: 'TRANSFORM',
        transformed: { ...ev, payload: redacted as Record<string, unknown> } as HazelEvent,
      };
    },
  };
}
