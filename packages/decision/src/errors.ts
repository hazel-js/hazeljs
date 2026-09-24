/**
 * Decision runtime errors — follow HazelJS package-local error style.
 */

export class DecisionError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DecisionError';
    this.code = code;
    this.details = details;
  }
}

export class DecisionValidationError extends DecisionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DECISION_VALIDATION', details);
    this.name = 'DecisionValidationError';
  }
}

export class DecisionProviderError extends DecisionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DECISION_PROVIDER', details);
    this.name = 'DecisionProviderError';
  }
}

export class DecisionTimeoutError extends DecisionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DECISION_TIMEOUT', details);
    this.name = 'DecisionTimeoutError';
  }
}

export class DecisionPolicyError extends DecisionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DECISION_POLICY', details);
    this.name = 'DecisionPolicyError';
  }
}

export class DecisionAuthorizationError extends DecisionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DECISION_AUTHORIZATION', details);
    this.name = 'DecisionAuthorizationError';
  }
}

export class DecisionExecutionError extends DecisionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DECISION_EXECUTION', details);
    this.name = 'DecisionExecutionError';
  }
}

export class DecisionReviewRequiredError extends DecisionError {
  readonly taskId?: string;
  readonly decisionId: string;

  constructor(message: string, decisionId: string, taskId?: string) {
    super(message, 'DECISION_REVIEW_REQUIRED', { decisionId, taskId });
    this.name = 'DecisionReviewRequiredError';
    this.decisionId = decisionId;
    this.taskId = taskId;
  }
}

export class DecisionInvalidOutputError extends DecisionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DECISION_INVALID_OUTPUT', details);
    this.name = 'DecisionInvalidOutputError';
  }
}
