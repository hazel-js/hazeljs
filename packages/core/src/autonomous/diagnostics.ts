/**
 * Stable diagnostic codes for autonomous configuration errors.
 */

export const AutonomousDiagnosticCodes = {
  CAPABILITY_INVALID: 'HAZEL_AUTONOMOUS_CAPABILITY_INVALID',
  MODE_INVALID: 'HAZEL_AUTONOMOUS_MODE_INVALID',
  OBSERVE_INVALID: 'HAZEL_AUTONOMOUS_OBSERVE_INVALID',
  METADATA_INVALID: 'HAZEL_AUTONOMOUS_METADATA_INVALID',
  GRANT_MISSING: 'HAZEL_AUTONOMOUS_GRANT_MISSING',
  LOOP_LIMIT: 'HAZEL_AUTONOMOUS_LOOP_LIMIT',
  RETRY_UNSAFE: 'HAZEL_AUTONOMOUS_RETRY_UNSAFE',
} as const;

export type AutonomousDiagnosticCode =
  (typeof AutonomousDiagnosticCodes)[keyof typeof AutonomousDiagnosticCodes];

export class AutonomousConfigurationError extends Error {
  readonly code: AutonomousDiagnosticCode;
  readonly service?: string;
  readonly method?: string;
  readonly suggestion?: string;

  constructor(opts: {
    code: AutonomousDiagnosticCode;
    message: string;
    service?: string;
    method?: string;
    suggestion?: string;
  }) {
    const parts = [
      opts.code,
      opts.service ? `Service:\n${opts.service}` : undefined,
      opts.method ? `Method:\n${opts.method}` : undefined,
      `Problem:\n${opts.message}`,
      opts.suggestion ? `Suggested resolution:\n${opts.suggestion}` : undefined,
    ].filter(Boolean);
    super(parts.join('\n\n'));
    this.name = 'AutonomousConfigurationError';
    this.code = opts.code;
    this.service = opts.service;
    this.method = opts.method;
    this.suggestion = opts.suggestion;
  }
}
