/**
 * Structured errors for HCEL chain execution.
 */

export enum HCELErrorCode {
  VALIDATION_FAILED = 'HCEL_VALIDATION_FAILED',
  OPERATION_FAILED = 'HCEL_OPERATION_FAILED',
  STREAMING_NOT_SUPPORTED = 'HCEL_STREAMING_NOT_SUPPORTED',
  RETRY_EXHAUSTED = 'HCEL_RETRY_EXHAUSTED',
}

export class HCELError extends Error {
  readonly code: HCELErrorCode;
  readonly chainId?: string;
  readonly operationId?: string;
  readonly operationType?: string;
  readonly cause?: Error;

  constructor(
    message: string,
    code: HCELErrorCode,
    options?: {
      chainId?: string;
      operationId?: string;
      operationType?: string;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'HCELError';
    this.code = code;
    this.chainId = options?.chainId;
    this.operationId = options?.operationId;
    this.operationType = options?.operationType;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, HCELError.prototype);
  }

  static validationFailed(
    operationType: string,
    operationId: string,
    chainId: string,
    detail?: string
  ): HCELError {
    return new HCELError(
      `HCEL validation failed for ${operationType} (${operationId})${detail ? `: ${detail}` : ''}`,
      HCELErrorCode.VALIDATION_FAILED,
      { chainId, operationId, operationType }
    );
  }

  static operationFailed(
    operationType: string,
    operationId: string,
    chainId: string,
    cause?: unknown
  ): HCELError {
    const err = cause instanceof Error ? cause : undefined;
    const msg = err?.message ?? String(cause ?? 'unknown error');
    return new HCELError(
      `HCEL operation ${operationType} (${operationId}) failed: ${msg}`,
      HCELErrorCode.OPERATION_FAILED,
      { chainId, operationId, operationType, cause: err }
    );
  }

  static streamingNotSupported(lastOpType: string, chainId: string): HCELError {
    return new HCELError(
      `HCEL streaming requires the last operation to be type "prompt"; got "${lastOpType}". ` +
        `Use execute() for chains that end with rag, agent, ml, or other non-prompt operations.`,
      HCELErrorCode.STREAMING_NOT_SUPPORTED,
      { chainId, operationType: lastOpType }
    );
  }

  static retryExhausted(
    operationType: string,
    operationId: string,
    chainId: string,
    attempts: number,
    cause?: unknown
  ): HCELError {
    const err = cause instanceof Error ? cause : undefined;
    return new HCELError(
      `HCEL retries exhausted after ${attempts} attempt(s) for ${operationType} (${operationId})`,
      HCELErrorCode.RETRY_EXHAUSTED,
      { chainId, operationId, operationType, cause: err }
    );
  }
}
