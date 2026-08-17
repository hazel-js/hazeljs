/**
 * Gatekeeper error codes — stable, machine-readable.
 */
export const GatekeeperErrorCodes = {
  DENIED: 'GATEKEEPER_DENIED',
  DEFAULT_DENY: 'GATEKEEPER_DEFAULT_DENY',
  VALIDATION: 'GATEKEEPER_VALIDATION',
  APPROVAL_REQUIRED: 'GATEKEEPER_APPROVAL_REQUIRED',
  APPROVAL_INVALID: 'GATEKEEPER_APPROVAL_INVALID',
  POLICY: 'GATEKEEPER_POLICY',
  CONFIG: 'GATEKEEPER_CONFIG',
  EXECUTION: 'GATEKEEPER_EXECUTION',
  TENANT: 'GATEKEEPER_TENANT',
  BUDGET: 'GATEKEEPER_BUDGET',
  REWRITE_LIMIT: 'GATEKEEPER_REWRITE_LIMIT',
} as const;

export type GatekeeperErrorCode = (typeof GatekeeperErrorCodes)[keyof typeof GatekeeperErrorCodes];

export interface GatekeeperErrorDetails {
  code: GatekeeperErrorCode;
  /** Safe for user-facing display — no secrets or policy internals. */
  safeMessage: string;
  policyIds?: string[];
  invocationId?: string;
  toolName?: string;
}

export class GatekeeperError extends Error {
  readonly code: GatekeeperErrorCode;
  readonly safeDetails: GatekeeperErrorDetails;
  readonly cause?: Error;

  constructor(
    safeMessage: string,
    code: GatekeeperErrorCode,
    details?: Partial<Omit<GatekeeperErrorDetails, 'code' | 'safeMessage'>>,
    cause?: Error
  ) {
    super(safeMessage);
    this.name = 'GatekeeperError';
    this.code = code;
    this.safeDetails = {
      code,
      safeMessage,
      ...details,
    };
    this.cause = cause;
    Object.setPrototypeOf(this, GatekeeperError.prototype);
  }
}

export class GatekeeperDeniedError extends GatekeeperError {
  constructor(
    safeMessage: string,
    details?: Partial<Omit<GatekeeperErrorDetails, 'code' | 'safeMessage'>>,
    cause?: Error
  ) {
    super(safeMessage, GatekeeperErrorCodes.DENIED, details, cause);
    this.name = 'GatekeeperDeniedError';
    Object.setPrototypeOf(this, GatekeeperDeniedError.prototype);
  }
}

export class GatekeeperApprovalRequiredError extends GatekeeperError {
  readonly approvalRequestId: string;

  constructor(
    safeMessage: string,
    approvalRequestId: string,
    details?: Partial<Omit<GatekeeperErrorDetails, 'code' | 'safeMessage'>>,
    cause?: Error
  ) {
    super(safeMessage, GatekeeperErrorCodes.APPROVAL_REQUIRED, details, cause);
    this.name = 'GatekeeperApprovalRequiredError';
    this.approvalRequestId = approvalRequestId;
    Object.setPrototypeOf(this, GatekeeperApprovalRequiredError.prototype);
  }
}

export class GatekeeperValidationError extends GatekeeperError {
  constructor(
    safeMessage: string,
    details?: Partial<Omit<GatekeeperErrorDetails, 'code' | 'safeMessage'>>,
    cause?: Error
  ) {
    super(safeMessage, GatekeeperErrorCodes.VALIDATION, details, cause);
    this.name = 'GatekeeperValidationError';
    Object.setPrototypeOf(this, GatekeeperValidationError.prototype);
  }
}

export class GatekeeperPolicyError extends GatekeeperError {
  constructor(
    safeMessage: string,
    details?: Partial<Omit<GatekeeperErrorDetails, 'code' | 'safeMessage'>>,
    cause?: Error
  ) {
    super(safeMessage, GatekeeperErrorCodes.POLICY, details, cause);
    this.name = 'GatekeeperPolicyError';
    Object.setPrototypeOf(this, GatekeeperPolicyError.prototype);
  }
}

export class GatekeeperConfigurationError extends GatekeeperError {
  constructor(
    safeMessage: string,
    details?: Partial<Omit<GatekeeperErrorDetails, 'code' | 'safeMessage'>>,
    cause?: Error
  ) {
    super(safeMessage, GatekeeperErrorCodes.CONFIG, details, cause);
    this.name = 'GatekeeperConfigurationError';
    Object.setPrototypeOf(this, GatekeeperConfigurationError.prototype);
  }
}

export class GatekeeperExecutionError extends GatekeeperError {
  constructor(
    safeMessage: string,
    details?: Partial<Omit<GatekeeperErrorDetails, 'code' | 'safeMessage'>>,
    cause?: Error
  ) {
    super(safeMessage, GatekeeperErrorCodes.EXECUTION, details, cause);
    this.name = 'GatekeeperExecutionError';
    Object.setPrototypeOf(this, GatekeeperExecutionError.prototype);
  }
}
