/**
 * Agent OS Phase 2 — Autonomous Recovery Ladder
 * retry → circuit_breaker → fallback_agent → hitl → fail
 */

export type RecoveryStep =
  | 'retry'
  | 'circuit_breaker'
  | 'fallback_agent'
  | 'hitl'
  | 'fail';

export interface RecoveryLadderOptions {
  /** Ordered steps (default full ladder). */
  steps?: RecoveryStep[];
  maxRetries?: number;
  fallbackAgent?: string;
  /** Called when step is hitl — return true to continue after human approval. */
  onHitl?: (error: Error, attempt: number) => Promise<boolean>;
  /** Optional circuit breaker gate — return false if open. */
  isCircuitClosed?: () => boolean;
  /** Record failure into circuit breaker. */
  recordFailure?: () => void;
  recordSuccess?: () => void;
}

export interface RecoveryResult<T> {
  result?: T;
  success: boolean;
  stepsTaken: RecoveryStep[];
  attempts: number;
  error?: Error;
  usedFallback: boolean;
}

export async function runRecoveryLadder<T>(opts: {
  execute: () => Promise<T>;
  executeFallback?: () => Promise<T>;
  ladder?: RecoveryLadderOptions;
}): Promise<RecoveryResult<T>> {
  const ladder = opts.ladder ?? {};
  const steps = ladder.steps ?? ['retry', 'circuit_breaker', 'fallback_agent', 'hitl', 'fail'];
  const maxRetries = ladder.maxRetries ?? 3;
  const stepsTaken: RecoveryStep[] = [];
  let attempts = 0;
  let lastError: Error | undefined;
  let usedFallback = false;

  const tryExecute = async (fn: () => Promise<T>): Promise<T> => {
    attempts += 1;
    return fn();
  };

  for (const step of steps) {
    stepsTaken.push(step);

    if (step === 'circuit_breaker') {
      if (ladder.isCircuitClosed && !ladder.isCircuitClosed()) {
        lastError = new Error('Circuit breaker open');
        continue;
      }
    }

    if (step === 'retry') {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const result = await tryExecute(opts.execute);
          ladder.recordSuccess?.();
          return { result, success: true, stepsTaken, attempts, usedFallback: false };
        } catch (e) {
          lastError = e as Error;
          ladder.recordFailure?.();
        }
      }
      continue;
    }

    if (step === 'fallback_agent') {
      if (!opts.executeFallback && !ladder.fallbackAgent) continue;
      if (!opts.executeFallback) continue;
      try {
        const result = await tryExecute(opts.executeFallback);
        usedFallback = true;
        ladder.recordSuccess?.();
        return { result, success: true, stepsTaken, attempts, usedFallback };
      } catch (e) {
        lastError = e as Error;
        ladder.recordFailure?.();
        continue;
      }
    }

    if (step === 'hitl') {
      if (!ladder.onHitl || !lastError) continue;
      const approved = await ladder.onHitl(lastError, attempts);
      if (approved) {
        try {
          const result = await tryExecute(opts.execute);
          ladder.recordSuccess?.();
          return { result, success: true, stepsTaken, attempts, usedFallback };
        } catch (e) {
          lastError = e as Error;
        }
      }
      continue;
    }

    if (step === 'fail') {
      break;
    }
  }

  return {
    success: false,
    stepsTaken,
    attempts,
    error: lastError ?? new Error('Recovery ladder exhausted'),
    usedFallback,
  };
}
