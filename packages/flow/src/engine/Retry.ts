/**
 * Retry logic with fixed or exponential backoff
 */
import type { RetryPolicy } from '../types/FlowTypes.js';

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRetryDelayMs(attempt: number, policy: RetryPolicy): number {
  if (attempt >= policy.maxAttempts) return -1;
  let ms: number;
  if (policy.backoff === 'exponential') {
    ms = policy.baseDelayMs * Math.pow(2, attempt);
  } else {
    ms = policy.baseDelayMs;
  }
  if (policy.maxDelayMs != null && ms > policy.maxDelayMs) {
    ms = policy.maxDelayMs;
  }
  return ms;
}
