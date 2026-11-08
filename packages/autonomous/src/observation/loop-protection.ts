import type { AutonomousLoopProtection, AutonomousObservation } from '@hazeljs/core';
import { AutonomousConfigurationError, AutonomousDiagnosticCodes } from '@hazeljs/core';
import { DEFAULT_LOOP_PROTECTION } from '../types';

export class LoopProtector {
  private readonly recent = new Map<string, number>();
  private readonly eventFingerprints = new Map<string, number>();

  constructor(
    private readonly defaults: Required<AutonomousLoopProtection> = DEFAULT_LOOP_PROTECTION
  ) {}

  assertAllowed(
    observation: AutonomousObservation,
    protection: Required<AutonomousLoopProtection>,
    actionsInRun: number
  ): void {
    const depth = observation.depth ?? 0;
    if (depth > protection.maxDepth) {
      throw new AutonomousConfigurationError({
        code: AutonomousDiagnosticCodes.LOOP_LIMIT,
        message: `Observation depth ${depth} exceeds maxDepth ${protection.maxDepth}.`,
        suggestion:
          'Increase loopProtection.maxDepth only with care, or break the causation chain.',
      });
    }

    if (actionsInRun >= protection.maxActionsPerRun) {
      throw new AutonomousConfigurationError({
        code: AutonomousDiagnosticCodes.LOOP_LIMIT,
        message: `Run exceeded maxActionsPerRun (${protection.maxActionsPerRun}).`,
      });
    }

    const key = `${observation.eventType}:${observation.subject ?? ''}:${observation.tenantId ?? ''}`;
    const last = this.recent.get(key);
    const now = Date.now();
    if (last !== undefined && now - last < protection.cooldownMs) {
      throw new AutonomousConfigurationError({
        code: AutonomousDiagnosticCodes.LOOP_LIMIT,
        message: `Cooldown active for ${key} (${protection.cooldownMs}ms).`,
      });
    }
    this.recent.set(key, now);

    const fp = observation.eventId;
    if (this.eventFingerprints.has(fp)) {
      throw new AutonomousConfigurationError({
        code: AutonomousDiagnosticCodes.LOOP_LIMIT,
        message: `Duplicate observation eventId ${fp}.`,
      });
    }
    this.eventFingerprints.set(fp, now);

    // Bound memory
    if (this.eventFingerprints.size > 10_000) {
      const oldest = this.eventFingerprints.keys().next().value;
      if (oldest) this.eventFingerprints.delete(oldest);
    }
  }

  clear(): void {
    this.recent.clear();
    this.eventFingerprints.clear();
  }
}

export function mergeLoopProtection(
  ...parts: Array<AutonomousLoopProtection | undefined>
): Required<AutonomousLoopProtection> {
  return {
    maxDepth:
      parts.find((p) => p?.maxDepth !== undefined)?.maxDepth ?? DEFAULT_LOOP_PROTECTION.maxDepth,
    cooldownMs:
      parts.find((p) => p?.cooldownMs !== undefined)?.cooldownMs ??
      DEFAULT_LOOP_PROTECTION.cooldownMs,
    maxActionsPerRun:
      parts.find((p) => p?.maxActionsPerRun !== undefined)?.maxActionsPerRun ??
      DEFAULT_LOOP_PROTECTION.maxActionsPerRun,
  };
}
