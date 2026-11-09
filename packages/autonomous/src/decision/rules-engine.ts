import type {
  AutonomousDecision,
  AutonomousDecisionContext,
  AutonomousDecisionEngine,
} from '@hazeljs/core';

/**
 * Deterministic decision engine — no LLM required.
 * Heuristic: if a single granted capability matches observation event naming, propose execute/approval.
 */
export class RulesDecisionEngine implements AutonomousDecisionEngine {
  constructor(
    private readonly resolveCapabilityForEvent?: (
      eventType: string,
      allowed: string[]
    ) => string | undefined
  ) {}

  async evaluate(context: AutonomousDecisionContext): Promise<AutonomousDecision> {
    if (context.mode === 'disabled' || context.mode === 'observe-only') {
      return { type: 'no-action', reason: `Mode ${context.mode} does not execute effects` };
    }

    const capabilityId =
      this.resolveCapabilityForEvent?.(
        context.observation.eventType,
        context.allowedCapabilities
      ) ?? pickCapability(context.observation.eventType, context.allowedCapabilities);

    if (!capabilityId) {
      return {
        type: 'no-action',
        reason: 'No granted capability matches this observation',
      };
    }

    const args = normalizeArgs(context.observation.payload);

    if (context.mode === 'suggest') {
      return {
        type: 'recommend',
        recommendation: `Consider executing ${capabilityId}`,
        reason: `Observation ${context.observation.eventType}`,
      };
    }

    if (context.mode === 'approval-required') {
      return {
        type: 'request-approval',
        capabilityId,
        arguments: args,
        reason: `Mode approval-required for ${capabilityId}`,
      };
    }

    // governed-auto
    return {
      type: 'execute',
      capabilityId,
      arguments: args,
      reason: `Governed-auto proposal for ${capabilityId}`,
    };
  }
}

function pickCapability(eventType: string, allowed: string[]): string | undefined {
  if (allowed.length === 0) return undefined;
  const stem = eventType.split('.').slice(0, 2).join('.');
  const exact = allowed.find((c) => c === eventType || c.startsWith(stem));
  if (exact) return exact;
  // common mapping: orders.failed → orders.retry
  const retry = allowed.find((c) => c.endsWith('.retry') || c.endsWith('.fallback'));
  return retry ?? allowed[0];
}

function normalizeArgs(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { ...(payload as Record<string, unknown>) };
  }
  return { value: payload };
}
