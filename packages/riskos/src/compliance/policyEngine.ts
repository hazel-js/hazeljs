/**
 * Policy engine for compliance enforcement
 */

import type { HazelEvent } from '@hazeljs/contracts';

/** Policy outcome */
export type PolicyOutcome = 'ALLOW' | 'DENY' | 'TRANSFORM' | 'ESCALATE';

/** Policy result */
export interface PolicyResult {
  policy: string;
  result: PolicyOutcome;
  message?: string;
  transformed?: HazelEvent;
}

/** Policy hook phases */
export type PolicyPhase = 'before' | 'onEvent' | 'after';

/** Policy interface */
export interface Policy {
  name: string;
  /** When to run */
  phase: PolicyPhase;
  /** Check before action or on event */
  evaluate(ctx: PolicyContext): PolicyResult | Promise<PolicyResult>;
}

/** Context passed to policy evaluation */
export interface PolicyContext {
  actionName: string;
  tenantId?: string;
  actor?: { userId?: string; role?: string; ip?: string };
  purpose?: string;
  event?: HazelEvent;
  payload?: unknown;
}

/** Policy engine */
export class PolicyEngine {
  constructor(private readonly policies: Policy[] = []) {}

  /** Add policy */
  addPolicy(policy: Policy): void {
    this.policies.push(policy);
  }

  /** Evaluate before phase */
  async evaluateBefore(ctx: PolicyContext): Promise<PolicyResult[]> {
    return this.evaluatePhase('before', ctx);
  }

  /** Evaluate on event */
  async evaluateOnEvent(ctx: PolicyContext & { event: HazelEvent }): Promise<PolicyResult[]> {
    return this.evaluatePhase('onEvent', ctx);
  }

  /** Evaluate after phase */
  async evaluateAfter(ctx: PolicyContext): Promise<PolicyResult[]> {
    return this.evaluatePhase('after', ctx);
  }

  private async evaluatePhase(phase: PolicyPhase, ctx: PolicyContext): Promise<PolicyResult[]> {
    const results: PolicyResult[] = [];
    for (const p of this.policies) {
      if (p.phase !== phase) continue;
      const res = await p.evaluate(ctx);
      results.push(res);
      if (res.result === 'DENY') break;
    }
    return results;
  }
}
