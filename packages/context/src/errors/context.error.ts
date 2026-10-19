export enum ContextErrorCode {
  NO_CONTRIBUTORS = 'CONTEXT_NO_CONTRIBUTORS',
  PLAN_EMPTY = 'CONTEXT_PLAN_EMPTY',
  CONTRIBUTOR_FAILED = 'CONTEXT_CONTRIBUTOR_FAILED',
  TENANT_REQUIRED = 'CONTEXT_TENANT_REQUIRED',
  CONFIGURATION_ERROR = 'CONTEXT_CONFIGURATION_ERROR',
}

export class ContextError extends Error {
  readonly code: ContextErrorCode;
  readonly cause?: Error;

  constructor(message: string, code: ContextErrorCode, cause?: Error) {
    super(message);
    this.name = 'ContextError';
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, ContextError.prototype);
  }

  static noContributors(): ContextError {
    return new ContextError(
      'No context contributors registered. Provide contributors or cag/rag/kag/memory ports in ContextModule.forRoot().',
      ContextErrorCode.NO_CONTRIBUTORS
    );
  }

  static planEmpty(): ContextError {
    return new ContextError(
      'Context plan selected zero sources. Check strategy/sources configuration.',
      ContextErrorCode.PLAN_EMPTY
    );
  }

  static contributorFailed(kind: string, cause?: Error): ContextError {
    return new ContextError(
      `Context contributor "${kind}" failed.`,
      ContextErrorCode.CONTRIBUTOR_FAILED,
      cause
    );
  }

  static tenantRequired(): ContextError {
    return new ContextError(
      'tenantId is required for context assembly.',
      ContextErrorCode.TENANT_REQUIRED
    );
  }

  static configurationError(message: string): ContextError {
    return new ContextError(message, ContextErrorCode.CONFIGURATION_ERROR);
  }
}
