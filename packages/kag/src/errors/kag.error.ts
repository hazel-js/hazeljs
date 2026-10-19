/**
 * Structured KAG errors for robust handling and observability.
 */

export enum KagErrorCode {
  ENTITY_NOT_FOUND = 'KAG_ENTITY_NOT_FOUND',
  STORE_ERROR = 'KAG_STORE_ERROR',
  CONFLICT = 'KAG_CONFLICT',
  ACCESS_DENIED = 'KAG_ACCESS_DENIED',
  TENANT_REQUIRED = 'KAG_TENANT_REQUIRED',
  VALIDATION_ERROR = 'KAG_VALIDATION_ERROR',
  CONFIGURATION_ERROR = 'KAG_CONFIGURATION_ERROR',
}

export class KagError extends Error {
  readonly code: KagErrorCode;
  readonly cause?: Error;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: KagErrorCode,
    cause?: Error,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'KagError';
    this.code = code;
    this.cause = cause;
    this.details = details;
    Object.setPrototypeOf(this, KagError.prototype);
  }

  static entityNotFound(id: string): KagError {
    return new KagError(
      `Knowledge entity "${id}" was not found in the current tenant scope.`,
      KagErrorCode.ENTITY_NOT_FOUND
    );
  }

  static storeError(message: string, cause?: Error): KagError {
    return new KagError(message, KagErrorCode.STORE_ERROR, cause);
  }

  static conflict(message: string, details?: Record<string, unknown>): KagError {
    return new KagError(message, KagErrorCode.CONFLICT, undefined, details);
  }

  static accessDenied(resource: string): KagError {
    return new KagError(
      `Access denied for knowledge resource "${resource}".`,
      KagErrorCode.ACCESS_DENIED
    );
  }

  static tenantRequired(): KagError {
    return new KagError(
      'tenantId is required for knowledge operations. Pass a KnowledgeScope with tenantId.',
      KagErrorCode.TENANT_REQUIRED
    );
  }

  static validationError(message: string): KagError {
    return new KagError(message, KagErrorCode.VALIDATION_ERROR);
  }

  static configurationError(message: string): KagError {
    return new KagError(message, KagErrorCode.CONFIGURATION_ERROR);
  }
}

/** @deprecated Prefer KagError */
export class KnowledgeEntityNotFoundError extends KagError {
  constructor(id: string) {
    super(KagError.entityNotFound(id).message, KagErrorCode.ENTITY_NOT_FOUND);
    this.name = 'KnowledgeEntityNotFoundError';
  }
}

/** @deprecated Prefer KagError */
export class KnowledgeStoreError extends KagError {
  constructor(message: string, cause?: Error) {
    super(message, KagErrorCode.STORE_ERROR, cause);
    this.name = 'KnowledgeStoreError';
  }
}

/** @deprecated Prefer KagError */
export class KnowledgeConflictError extends KagError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, KagErrorCode.CONFLICT, undefined, details);
    this.name = 'KnowledgeConflictError';
  }
}

/** @deprecated Prefer KagError */
export class KnowledgeAccessDeniedError extends KagError {
  constructor(resource: string) {
    super(KagError.accessDenied(resource).message, KagErrorCode.ACCESS_DENIED);
    this.name = 'KnowledgeAccessDeniedError';
  }
}
