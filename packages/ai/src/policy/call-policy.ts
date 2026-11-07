import { AIError, AIErrorCode } from '../errors/ai.error';
import { AIProviderError } from '../errors/provider.error';
import type { AIRetryDefaults } from '../models/model-registry.types';

export interface CallPolicyOptions {
  timeoutMs?: number;
  retry?: AIRetryDefaults;
  /** Ordered fallback model names (caller resolves and invokes). */
  fallbackNames?: string[];
  abortSignal?: AbortSignal;
  /** When true, do not retry or fall back (e.g. after first stream byte or tool start). */
  committed?: boolean;
  /** Extra predicate; return false to skip fallback for this error. */
  fallbackIf?: (error: unknown) => boolean;
  label?: string;
}

export interface CallAttemptContext {
  modelName: string;
  attempt: number;
  isFallback: boolean;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason instanceof Error ? signal.reason : new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof AIProviderError && error.code === 'ABORT') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  if (error instanceof AIError && error.code === AIErrorCode.ABORTED) return true;
  return false;
}

export function isOutputInvalidError(error: unknown): boolean {
  return error instanceof AIError && error.code === AIErrorCode.OUTPUT_INVALID;
}

export function isRetryableProviderError(error: unknown): boolean {
  if (isAbortError(error) || isOutputInvalidError(error)) {
    return false;
  }
  if (error instanceof AIError && error.code === AIErrorCode.BUDGET_EXCEEDED) {
    return false;
  }
  const providerErr = AIProviderError.fromUnknown(error);
  if (providerErr.code === 'ABORT') return false;
  return providerErr.retryable;
}

function computeBackoffMs(attempt: number, retry?: AIRetryDefaults, retryAfterMs?: number): number {
  const delay = retry?.backoff?.delayMs ?? 1000;
  const factor = retry?.backoff?.factor ?? 2;
  const maxDelay = retry?.backoff?.maxDelayMs ?? 30_000;
  let wait = delay * Math.pow(factor, attempt - 1);
  if (retry?.backoff?.jitter !== false) {
    wait = Math.random() * wait;
  }
  wait = Math.min(wait, maxDelay);
  if (retryAfterMs !== undefined) {
    if (retryAfterMs > maxDelay) {
      return -1; // signal: skip further retries, move to fallback
    }
    wait = Math.max(wait, retryAfterMs);
  }
  return wait;
}

/**
 * Run `fn` under timeout / retry for one model, then optional fallbacks via `runFallback`.
 */
export async function executeWithCallPolicy<T>(
  primaryName: string,
  fn: (ctx: CallAttemptContext) => Promise<T>,
  options: CallPolicyOptions,
  runFallback?: (name: string) => Promise<T>
): Promise<T> {
  if (options.abortSignal?.aborted) {
    throw AIError.aborted(options.abortSignal.reason);
  }

  const attempts = Math.max(1, options.retry?.attempts ?? 3);
  const attemptsLog: Array<{ model: string; attempt: number; error: unknown }> = [];
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (options.abortSignal?.aborted) {
      throw AIError.aborted(options.abortSignal.reason);
    }
    try {
      return await runAttempt(fn, {
        modelName: primaryName,
        attempt,
        isFallback: false,
        timeoutMs: options.timeoutMs,
        signal: options.abortSignal,
      });
    } catch (error) {
      lastError = error;
      attemptsLog.push({ model: primaryName, attempt, error });

      if (options.committed || isAbortError(error) || isOutputInvalidError(error)) {
        throw error;
      }
      if (!isRetryableProviderError(error)) {
        // Non-retryable: still allow fallback if configured and fallbackIf allows it.
        break;
      }
      if (attempt >= attempts) {
        break;
      }
      const providerErr = AIProviderError.fromUnknown(error);
      const wait = computeBackoffMs(attempt, options.retry, providerErr.retryAfterMs);
      if (wait < 0) {
        break;
      }
      await sleep(wait, options.abortSignal);
    }
  }

  const fallbacks = options.fallbackNames ?? [];
  const allowFallback =
    runFallback &&
    fallbacks.length > 0 &&
    !options.committed &&
    !isAbortError(lastError) &&
    !isOutputInvalidError(lastError) &&
    (options.fallbackIf ? options.fallbackIf(lastError) : true);

  if (allowFallback) {
    for (const name of fallbacks) {
      try {
        return await runFallback(name);
      } catch (error) {
        lastError = error;
        attemptsLog.push({ model: name, attempt: 1, error });
        if (isAbortError(error) || isOutputInvalidError(error) || options.committed) {
          throw error;
        }
        if (!(options.fallbackIf ? options.fallbackIf(error) : true)) {
          throw error;
        }
      }
    }
  } else if (lastError && !isRetryableProviderError(lastError)) {
    // Preserve the original provider error (statusCode) for callers / fallbackIf.
    throw lastError;
  }

  throw AIError.modelFailed(
    `Every attempt failed for model "${primaryName}"${fallbacks.length ? ` and fallbacks [${fallbacks.join(', ')}]` : ''}`,
    lastError instanceof Error ? lastError : new Error(String(lastError)),
    attemptsLog
  );
}

async function runAttempt<T>(
  fn: (ctx: CallAttemptContext) => Promise<T>,
  opts: {
    modelName: string;
    attempt: number;
    isFallback: boolean;
    timeoutMs?: number;
    signal?: AbortSignal;
  }
): Promise<T> {
  const ctx: CallAttemptContext = {
    modelName: opts.modelName,
    attempt: opts.attempt,
    isFallback: opts.isFallback,
  };

  if (!opts.timeoutMs || opts.timeoutMs <= 0) {
    return fn(ctx);
  }

  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new AIProviderError(`Model attempt timed out after ${opts.timeoutMs}ms`, {
          code: 'ETIMEDOUT',
          retryable: true,
        })
      );
    }, opts.timeoutMs);
  });

  const abortPromise =
    opts.signal &&
    new Promise<never>((_, reject) => {
      if (opts.signal!.aborted) {
        reject(AIError.aborted(opts.signal!.reason));
        return;
      }
      opts.signal!.addEventListener('abort', () => reject(AIError.aborted(opts.signal!.reason)), {
        once: true,
      });
    });

  try {
    const racers: Promise<T>[] = [fn(ctx), timeoutPromise];
    if (abortPromise) racers.push(abortPromise);
    return await Promise.race(racers);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function estimateCost(
  usage: { promptTokens: number; completionTokens: number; cachedInputTokens?: number },
  pricing?: { input: number; output: number; cachedInput?: number }
): number | undefined {
  if (!pricing) return undefined;
  const cached = usage.cachedInputTokens ?? 0;
  const uncachedInput = Math.max(0, usage.promptTokens - cached);
  const cachedRate = pricing.cachedInput ?? pricing.input;
  return (
    (uncachedInput / 1_000_000) * pricing.input +
    (cached / 1_000_000) * cachedRate +
    (usage.completionTokens / 1_000_000) * pricing.output
  );
}
