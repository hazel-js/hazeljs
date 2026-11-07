/**
 * Normalized provider failure so call policy can decide retry / fallback.
 */
export class AIProviderError extends Error {
  readonly statusCode?: number;
  readonly retryAfterMs?: number;
  readonly retryable: boolean;
  readonly code?: string;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      retryAfterMs?: number;
      retryable?: boolean;
      code?: string;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = 'AIProviderError';
    this.statusCode = options?.statusCode;
    this.retryAfterMs = options?.retryAfterMs;
    this.code = options?.code;
    const status = options?.statusCode;
    const defaultRetryable =
      status === 408 ||
      status === 409 ||
      status === 429 ||
      (typeof status === 'number' && status >= 500) ||
      options?.code === 'ETIMEDOUT' ||
      options?.code === 'ECONNRESET' ||
      options?.code === 'ECONNREFUSED' ||
      options?.code === 'ENOTFOUND';
    this.retryable =
      options?.retryable !== undefined ? options.retryable : Boolean(defaultRetryable);
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
    Object.setPrototypeOf(this, AIProviderError.prototype);
  }

  static fromUnknown(error: unknown): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return new AIProviderError(error.message || 'Aborted', {
        retryable: false,
        code: 'ABORT',
        cause: error,
      });
    }

    const anyErr = error as {
      status?: number;
      statusCode?: number;
      code?: string;
      message?: string;
      headers?: Record<string, string | string[] | undefined>;
      response?: { status?: number; headers?: Record<string, string | undefined> };
      cause?: unknown;
    };

    const statusCode =
      anyErr?.statusCode ?? anyErr?.status ?? anyErr?.response?.status ?? undefined;
    const headers = anyErr?.headers ?? anyErr?.response?.headers;
    let retryAfterMs: number | undefined;
    const retryAfter = headers?.['retry-after'] ?? headers?.['Retry-After'];
    if (typeof retryAfter === 'string') {
      const asNum = Number(retryAfter);
      if (!Number.isNaN(asNum)) {
        retryAfterMs = asNum * 1000;
      }
    } else if (Array.isArray(retryAfter) && retryAfter[0]) {
      const asNum = Number(retryAfter[0]);
      if (!Number.isNaN(asNum)) {
        retryAfterMs = asNum * 1000;
      }
    }

    const code = typeof anyErr?.code === 'string' ? anyErr.code : undefined;
    const message =
      (error instanceof Error ? error.message : undefined) ||
      anyErr?.message ||
      'Provider request failed';

    return new AIProviderError(message, {
      statusCode,
      retryAfterMs,
      code,
      cause: error,
    });
  }
}
