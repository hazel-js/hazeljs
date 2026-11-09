import { AutonomousConfigurationError, AutonomousDiagnosticCodes } from './diagnostics';
import type {
  AutonomousMode,
  AutonomousOptions,
  CapabilityMetadata,
  CapabilityOptions,
} from './types';

const VALID_MODES: AutonomousMode[] = [
  'disabled',
  'observe-only',
  'suggest',
  'approval-required',
  'governed-auto',
];

export function assertValidAutonomousOptions(
  options: AutonomousOptions,
  serviceName = 'UnknownService'
): void {
  if (options.mode !== undefined && !VALID_MODES.includes(options.mode)) {
    throw new AutonomousConfigurationError({
      code: AutonomousDiagnosticCodes.MODE_INVALID,
      service: serviceName,
      message: `Unknown mode "${String(options.mode)}".`,
      suggestion: `Use one of: ${VALID_MODES.join(', ')}.`,
    });
  }

  if (options.limits?.maxDecisionsPerHour !== undefined && options.limits.maxDecisionsPerHour < 0) {
    throw new AutonomousConfigurationError({
      code: AutonomousDiagnosticCodes.METADATA_INVALID,
      service: serviceName,
      message: 'limits.maxDecisionsPerHour must be >= 0.',
    });
  }

  if (options.loopProtection?.maxDepth !== undefined && options.loopProtection.maxDepth < 1) {
    throw new AutonomousConfigurationError({
      code: AutonomousDiagnosticCodes.METADATA_INVALID,
      service: serviceName,
      message: 'loopProtection.maxDepth must be >= 1.',
    });
  }
}

export function assertValidCapabilityOptions(
  options: CapabilityOptions,
  serviceName: string,
  methodName: string
): void {
  if (!options.id || typeof options.id !== 'string' || !options.id.trim()) {
    throw new AutonomousConfigurationError({
      code: AutonomousDiagnosticCodes.CAPABILITY_INVALID,
      service: serviceName,
      method: methodName,
      message: 'Capability id is required.',
    });
  }

  if (options.effect === 'irreversible') {
    const retriesBlind = options.idempotencyKey === undefined && options.reconcile === undefined;
    // Flag for runtime: irreversible without safety contract cannot auto-retry.
    // Validation of retry config happens when Autonomous recovery.retry is set.
    void retriesBlind;
  }

  if (options.timeoutMs !== undefined && options.timeoutMs <= 0) {
    throw new AutonomousConfigurationError({
      code: AutonomousDiagnosticCodes.CAPABILITY_INVALID,
      service: serviceName,
      method: methodName,
      message: 'timeoutMs must be > 0.',
    });
  }
}

/**
 * Validate that irreversible capabilities are not configured for blind retry.
 */
export function assertCapabilityRetrySafety(
  capability: CapabilityMetadata,
  retryAttempts: number | undefined,
  serviceName: string
): void {
  if (!retryAttempts || retryAttempts <= 1) return;
  if (capability.effect !== 'irreversible') return;
  if (capability.idempotencyKey || capability.reconcile) return;

  throw new AutonomousConfigurationError({
    code: AutonomousDiagnosticCodes.RETRY_UNSAFE,
    service: serviceName,
    method: capability.propertyKey,
    message:
      'An irreversible capability cannot be retried without a verified idempotency or reconciliation contract.',
    suggestion:
      'Configure provider-backed idempotency, register a reconciliation handler, or disable automatic retry.',
  });
}
