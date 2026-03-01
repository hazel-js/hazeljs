/**
 * GuardrailViolationError - Thrown when guardrail check fails
 */

export class GuardrailViolationError extends Error {
  constructor(
    message: string,
    public readonly violations?: string[],
    public readonly blockedReason?: string
  ) {
    super(message);
    this.name = 'GuardrailViolationError';
    Object.setPrototypeOf(this, GuardrailViolationError.prototype);
  }

  toJSON(): {
    message: string;
    violations?: string[];
    blockedReason?: string;
  } {
    return {
      message: this.message,
      violations: this.violations,
      blockedReason: this.blockedReason,
    };
  }
}
