/**
 * Structured CAG errors for robust handling and observability.
 */

export enum CagErrorCode {
  CONTEXT_NOT_FOUND = 'CAG_CONTEXT_NOT_FOUND',
  STORE_ERROR = 'CAG_STORE_ERROR',
  TOKEN_BUDGET_EXCEEDED = 'CAG_TOKEN_BUDGET_EXCEEDED',
  TENANT_REQUIRED = 'CAG_TENANT_REQUIRED',
  SOURCE_LOAD_FAILED = 'CAG_SOURCE_LOAD_FAILED',
  CONFIGURATION_ERROR = 'CAG_CONFIGURATION_ERROR',
}

export class CagError extends Error {
  readonly code: CagErrorCode;
  readonly cause?: Error;

  constructor(message: string, code: CagErrorCode, cause?: Error) {
    super(message);
    this.name = 'CagError';
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, CagError.prototype);
  }

  static contextNotFound(namespace: string, tenantId: string): CagError {
    return new CagError(
      `Cached context not found for namespace "${namespace}" (tenant "${tenantId}"). ` +
        `Register sources and call getContext() to build it.`,
      CagErrorCode.CONTEXT_NOT_FOUND
    );
  }

  static storeError(message: string, cause?: Error): CagError {
    return new CagError(message, CagErrorCode.STORE_ERROR, cause);
  }

  static tokenBudgetExceeded(max: number, actual: number): CagError {
    return new CagError(
      `Token budget exceeded: assembled context uses ~${actual} tokens but max is ${max}. ` +
        `Reduce sources, raise maxTokens, or use strategy "priority" / "compress".`,
      CagErrorCode.TOKEN_BUDGET_EXCEEDED
    );
  }

  static tenantRequired(): CagError {
    return new CagError(
      'tenantId is required when multi-tenant mode is enabled (default). ' +
        'Pass tenantId in getContext() or set multiTenant: false in CagModule.forRoot().',
      CagErrorCode.TENANT_REQUIRED
    );
  }

  static sourceLoadFailed(sourceId: string, cause?: Error): CagError {
    return new CagError(
      `Failed to load context source "${sourceId}".`,
      CagErrorCode.SOURCE_LOAD_FAILED,
      cause
    );
  }

  static configurationError(message: string): CagError {
    return new CagError(message, CagErrorCode.CONFIGURATION_ERROR);
  }
}

/** @deprecated Prefer CagError with CagErrorCode.CONTEXT_NOT_FOUND */
export class CagContextNotFoundError extends CagError {
  constructor(namespace: string, tenantId: string) {
    super(CagError.contextNotFound(namespace, tenantId).message, CagErrorCode.CONTEXT_NOT_FOUND);
    this.name = 'CagContextNotFoundError';
  }
}

/** @deprecated Prefer CagError with CagErrorCode.STORE_ERROR */
export class CagStoreError extends CagError {
  constructor(message: string, cause?: Error) {
    super(message, CagErrorCode.STORE_ERROR, cause);
    this.name = 'CagStoreError';
  }
}

/** @deprecated Prefer CagError with CagErrorCode.TOKEN_BUDGET_EXCEEDED */
export class CagTokenBudgetExceededError extends CagError {
  constructor(max: number, actual: number) {
    super(CagError.tokenBudgetExceeded(max, actual).message, CagErrorCode.TOKEN_BUDGET_EXCEEDED);
    this.name = 'CagTokenBudgetExceededError';
  }
}
