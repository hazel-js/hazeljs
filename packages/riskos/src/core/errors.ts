/**
 * RiskOS error types
 */

/** Base RiskOS error */
export class RiskOSError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'RiskOSError';
    Object.setPrototypeOf(this, RiskOSError.prototype);
  }
}

/** Policy denied the action */
export class PolicyDeniedError extends RiskOSError {
  constructor(
    message: string,
    public readonly policyName?: string,
  ) {
    super(message, 'POLICY_DENIED');
    this.name = 'PolicyDeniedError';
    Object.setPrototypeOf(this, PolicyDeniedError.prototype);
  }
}

/** KYC validation failed */
export class KycValidationError extends RiskOSError {
  constructor(
    message: string,
    public readonly errors?: unknown[],
  ) {
    super(message, 'KYC_VALIDATION');
    this.name = 'KycValidationError';
    Object.setPrototypeOf(this, KycValidationError.prototype);
  }
}

/** Provider/API call failed */
export class ProviderError extends RiskOSError {
  constructor(
    message: string,
    public readonly providerName?: string,
    public readonly statusCode?: number,
  ) {
    super(message, 'PROVIDER_ERROR');
    this.name = 'ProviderError';
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}
