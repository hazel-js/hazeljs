import type { RetryOptions } from '../types/send.types';

const DEFAULT_RETRY: Required<Omit<RetryOptions, 'retryIf'>> & {
  retryIf?: RetryOptions['retryIf'];
} = {
  attempts: 3,
  backoff: 'exponential',
  delayMs: 250,
};

export function resolveRetry(options: RetryOptions | false | undefined): RetryOptions | false {
  if (options === false) {
    return false;
  }
  return { ...DEFAULT_RETRY, ...(options ?? {}) };
}

export function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return true;
  }
  const err = error as { code?: string; status?: number; statusCode?: number; message?: string };
  const status = err.status ?? err.statusCode;
  if (typeof status === 'number') {
    return status === 408 || status === 429 || status >= 500;
  }
  const code = (err.code ?? '').toUpperCase();
  if (['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND'].includes(code)) {
    return true;
  }
  return true;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions | false
): Promise<T> {
  if (options === false) {
    return fn();
  }
  const attempts = options.attempts ?? DEFAULT_RETRY.attempts;
  const delayMs = options.delayMs ?? DEFAULT_RETRY.delayMs;
  const backoff = options.backoff ?? DEFAULT_RETRY.backoff;
  const retryIf = options.retryIf ?? isTransientError;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !retryIf(error)) {
        throw error;
      }
      const wait = backoff === 'exponential' ? delayMs * 2 ** (attempt - 1) : delayMs;
      await sleep(wait);
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
