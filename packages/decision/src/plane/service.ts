/**
 * Provider-neutral Decision Plane orchestrator.
 * Additive — does not change DecisionRuntime.
 */

import { randomUUID } from 'crypto';
import type { DecisionDefinition } from './definition';
import {
  deserializePlaneResult,
  MemoryDecisionCacheStore,
  planeCacheKey,
  planeInputDigest,
  serializePlaneResult,
  type DecisionCacheStore,
} from './cache';
import type {
  PlaneDecideRequest,
  PlaneExecutionContext,
  PlaneProviderCapabilities,
  PlaneResult,
  PlaneUsage,
} from './result';
import {
  createOpenAiDecisionsProvider,
  createRulesPlaneProvider,
  listDefaultPlaneCapabilities,
  type PlaneProvider,
  type PlaneProviderOutcome,
} from './providers';

export interface PlaneResilienceHooks {
  /** Optional circuit / rate-limit wrapper around a provider call. */
  wrap?<T>(providerName: string, fn: () => Promise<T>): Promise<T>;
}

export interface DecisionPlaneOptions {
  providers?: PlaneProvider[];
  cacheStore?: DecisionCacheStore;
  resilience?: PlaneResilienceHooks;
  /** Default timeout when definition omits timeoutMs. */
  defaultTimeoutMs?: number;
}

export interface DecisionPlane {
  decide<TAnswers extends readonly string[], TContext = unknown>(
    request: PlaneDecideRequest<TAnswers, TContext>
  ): Promise<PlaneResult<TAnswers[number]>>;
  capabilities(): PlaneProviderCapabilities[];
  getProvider(name: string): PlaneProvider | undefined;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      reject(err);
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      const err = new Error('Aborted');
      err.name = 'AbortError';
      reject(err);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function jitter(baseMs: number, attempt: number): number {
  const exp = Math.min(baseMs * 2 ** attempt, 5000);
  return Math.floor(exp * (0.5 + Math.random() * 0.5));
}

function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || /aborted/i.test(e.message));
}

function isRetryable(e: unknown): boolean {
  if (isAbortError(e)) return true;
  if (!(e instanceof Error)) return false;
  const code = (e as Error & { code?: string }).code;
  if (code === 'AUTH' || code === 'UNSUPPORTED') return false;
  if (code === 'RATE_LIMIT') return true;
  return /timeout|ETIMEDOUT|ECONNRESET|429|rate.?limit/i.test(e.message);
}

function isAuthOrConfigError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const code = (e as Error & { code?: string }).code;
  return (
    code === 'AUTH' || code === 'UNSUPPORTED' || /401|403|unauthor|unsupported/i.test(e.message)
  );
}

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  outer?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const onOuter = (): void => controller.abort();
  if (outer?.aborted) {
    controller.abort();
  } else {
    outer?.addEventListener('abort', onOuter, { once: true });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      const err = new Error(`Decision timed out after ${timeoutMs}ms`);
      err.name = 'AbortError';
      reject(err);
    }, timeoutMs);
    if (controller.signal.aborted) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      reject(err);
    } else {
      controller.signal.addEventListener(
        'abort',
        () => {
          if (timer) clearTimeout(timer);
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        },
        { once: true }
      );
    }
  });

  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
    outer?.removeEventListener('abort', onOuter);
  }
}

function toUsage(outcome: PlaneProviderOutcome): PlaneUsage {
  if (outcome.kind !== 'answer' || !outcome.usage) {
    return { known: false };
  }
  const { inputTokens, outputTokens, costUsd } = outcome.usage;
  if (inputTokens === undefined && outputTokens === undefined && costUsd === undefined) {
    return { known: false };
  }
  return { known: true, inputTokens, outputTokens, costUsd };
}

function baseFields(
  definition: DecisionDefinition,
  execution: PlaneExecutionContext,
  providerName: string,
  latencyMs: number,
  inputDigest: string,
  summary: string,
  outcome: PlaneProviderOutcome
): Omit<PlaneResult, 'status' | 'answer' | 'reason' | 'code' | 'rawAnswer'> {
  return {
    decisionId: `pdec_${randomUUID()}`,
    definitionId: definition.id,
    definitionVersion: definition.version,
    provider: providerName,
    model: outcome.model,
    latencyMs,
    summary: summary.slice(0, 500),
    policyVersion: execution.policyVersion ?? definition.policyVersion,
    inputDigest,
    traceId: execution.traceId,
    usage: toUsage(outcome),
    confidence: outcome.kind === 'answer' ? outcome.confidence : undefined,
  };
}

function mapOutcome<TAnswer extends string>(
  definition: DecisionDefinition,
  execution: PlaneExecutionContext,
  providerName: string,
  latencyMs: number,
  inputDigest: string,
  outcome: PlaneProviderOutcome<TAnswer>
): PlaneResult<TAnswer> {
  const base = baseFields(
    definition,
    execution,
    providerName,
    latencyMs,
    inputDigest,
    outcome.summary,
    outcome
  );
  switch (outcome.kind) {
    case 'answer':
      return { ...base, status: 'succeeded', answer: outcome.answer };
    case 'abstain':
      return { ...base, status: 'abstained', reason: outcome.reason };
    case 'unavailable':
      return { ...base, status: 'unavailable', reason: outcome.reason, code: outcome.code };
    case 'invalid':
      return {
        ...base,
        status: 'invalid',
        reason: outcome.reason,
        rawAnswer: outcome.rawAnswer,
      };
  }
}

export function createDecisionPlane(options: DecisionPlaneOptions = {}): DecisionPlane {
  const registry = new Map<string, PlaneProvider>();
  for (const p of options.providers ?? []) {
    registry.set(p.name, p);
  }
  if (!registry.has('openai-decisions')) {
    registry.set('openai-decisions', createOpenAiDecisionsProvider());
  }
  if (!registry.has('rules') && (options.providers?.length ?? 0) === 0) {
    registry.set(
      'rules',
      createRulesPlaneProvider({
        rules: [],
        onNoMatch: 'abstain',
      })
    );
  }

  const cacheStore = options.cacheStore ?? new MemoryDecisionCacheStore();
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000;

  async function callProvider(
    provider: PlaneProvider,
    definition: DecisionDefinition,
    context: unknown,
    signal: AbortSignal,
    maxRetries: number,
    retryBaseMs: number
  ): Promise<PlaneProviderOutcome> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const run = (): Promise<PlaneProviderOutcome> =>
          provider.decide({ definition, context, signal });
        if (options.resilience?.wrap) {
          return await options.resilience.wrap(provider.name, run);
        }
        return await run();
      } catch (e) {
        lastError = e;
        if (isAuthOrConfigError(e)) throw e;
        if (!isRetryable(e) || attempt >= maxRetries) throw e;
        await sleep(jitter(retryBaseMs, attempt), signal);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  return {
    capabilities(): PlaneProviderCapabilities[] {
      const fromRegistry = [...registry.values()].map((p) => p.capabilities);
      const defaults = listDefaultPlaneCapabilities();
      const names = new Set(fromRegistry.map((c) => c.name));
      return [...fromRegistry, ...defaults.filter((d) => !names.has(d.name))];
    },

    getProvider(name: string): PlaneProvider | undefined {
      return registry.get(name);
    },

    async decide<TAnswers extends readonly string[], TContext = unknown>(
      request: PlaneDecideRequest<TAnswers, TContext>
    ): Promise<PlaneResult<TAnswers[number]>> {
      const { definition, context, execution, signal } = request;
      const inputDigest = planeInputDigest(context);
      const strategy = definition.strategy ?? {
        providers: ['rules'],
        onFailure: 'abstain' as const,
        maxRetries: 0,
      };
      const providerNames = [...strategy.providers];
      const strategyKey = providerNames.join(',');
      const timeoutMs = definition.timeoutMs ?? defaultTimeoutMs;
      const maxRetries = strategy.maxRetries ?? 1;
      const retryBaseMs = strategy.retryBaseMs ?? 50;

      const cacheEnabled =
        !!definition.cache?.enabled &&
        !definition.securityCritical &&
        definition.cache.enabled === true;
      const cacheKey = cacheEnabled
        ? planeCacheKey({
            definition,
            execution,
            inputDigest,
            providerStrategy: strategyKey,
          })
        : null;

      if (cacheKey) {
        const hit = await cacheStore.get(cacheKey);
        if (hit) {
          const cached = deserializePlaneResult(hit);
          if (cached) {
            return {
              ...cached,
              decisionId: `pdec_${randomUUID()}`,
              inputDigest,
              traceId: execution.traceId ?? cached.traceId,
            } as PlaneResult<TAnswers[number]>;
          }
        }
      }

      const t0 = Date.now();
      let lastUnavailable: PlaneResult<TAnswers[number]> | undefined;
      let lastInvalid: PlaneResult<TAnswers[number]> | undefined;

      for (const name of providerNames) {
        const provider = registry.get(name);
        if (!provider) {
          lastUnavailable = {
            decisionId: `pdec_${randomUUID()}`,
            definitionId: definition.id,
            definitionVersion: definition.version,
            provider: name,
            latencyMs: Date.now() - t0,
            summary: `Provider "${name}" is not registered.`,
            policyVersion: execution.policyVersion ?? definition.policyVersion,
            inputDigest,
            traceId: execution.traceId,
            usage: { known: false },
            status: 'unavailable',
            reason: `Provider "${name}" is not registered`,
            code: 'provider_not_registered',
          };
          continue;
        }

        try {
          const outcome = await withTimeout(
            (innerSignal) =>
              callProvider(provider, definition, context, innerSignal, maxRetries, retryBaseMs),
            timeoutMs,
            signal
          );

          if (outcome.kind === 'answer') {
            if (!definition.answers.includes(outcome.answer)) {
              lastInvalid = mapOutcome(definition, execution, name, Date.now() - t0, inputDigest, {
                kind: 'invalid',
                summary: 'Provider returned an unknown answer.',
                reason: `Answer "${String(outcome.answer)}" is not in the allowed set`,
                rawAnswer: String(outcome.answer),
                model: outcome.model,
              }) as PlaneResult<TAnswers[number]>;
              continue;
            }
            const result = mapOutcome(
              definition,
              execution,
              name,
              Date.now() - t0,
              inputDigest,
              outcome
            ) as PlaneResult<TAnswers[number]>;
            if (cacheKey && definition.cache?.ttlMs) {
              await cacheStore.set(cacheKey, serializePlaneResult(result), definition.cache.ttlMs);
            }
            return result;
          }

          if (outcome.kind === 'abstain') {
            return mapOutcome(
              definition,
              execution,
              name,
              Date.now() - t0,
              inputDigest,
              outcome
            ) as PlaneResult<TAnswers[number]>;
          }

          if (outcome.kind === 'invalid') {
            lastInvalid = mapOutcome(
              definition,
              execution,
              name,
              Date.now() - t0,
              inputDigest,
              outcome
            ) as PlaneResult<TAnswers[number]>;
            continue;
          }

          lastUnavailable = mapOutcome(
            definition,
            execution,
            name,
            Date.now() - t0,
            inputDigest,
            outcome
          ) as PlaneResult<TAnswers[number]>;
        } catch (e) {
          if (isAbortError(e) || (signal?.aborted ?? false)) {
            return {
              decisionId: `pdec_${randomUUID()}`,
              definitionId: definition.id,
              definitionVersion: definition.version,
              provider: name,
              latencyMs: Date.now() - t0,
              summary: 'Decision timed out or was cancelled.',
              policyVersion: execution.policyVersion ?? definition.policyVersion,
              inputDigest,
              traceId: execution.traceId,
              usage: { known: false },
              status: 'timed_out',
              reason: e instanceof Error ? e.message : 'timeout',
            };
          }
          if (isAuthOrConfigError(e)) {
            return {
              decisionId: `pdec_${randomUUID()}`,
              definitionId: definition.id,
              definitionVersion: definition.version,
              provider: name,
              latencyMs: Date.now() - t0,
              summary: 'Provider authorization or configuration failed.',
              policyVersion: execution.policyVersion ?? definition.policyVersion,
              inputDigest,
              traceId: execution.traceId,
              usage: { known: false },
              status: 'unavailable',
              reason: e instanceof Error ? e.message : String(e),
              code: 'provider_auth_or_config',
            };
          }
          lastUnavailable = {
            decisionId: `pdec_${randomUUID()}`,
            definitionId: definition.id,
            definitionVersion: definition.version,
            provider: name,
            latencyMs: Date.now() - t0,
            summary: 'Provider call failed.',
            policyVersion: execution.policyVersion ?? definition.policyVersion,
            inputDigest,
            traceId: execution.traceId,
            usage: { known: false },
            status: 'unavailable',
            reason: e instanceof Error ? e.message : String(e),
            code: 'provider_error',
          };
        }
      }

      const onFailure = strategy.onFailure ?? 'abstain';
      if (onFailure === 'abstain' || onFailure === 'escalate' || onFailure === 'review') {
        return {
          decisionId: `pdec_${randomUUID()}`,
          definitionId: definition.id,
          definitionVersion: definition.version,
          provider: providerNames[providerNames.length - 1] ?? 'none',
          latencyMs: Date.now() - t0,
          summary: `All providers exhausted; safe behavior=${onFailure}.`,
          policyVersion: execution.policyVersion ?? definition.policyVersion,
          inputDigest,
          traceId: execution.traceId,
          usage: { known: false },
          status: 'abstained',
          reason: onFailure,
        };
      }

      return (
        lastUnavailable ??
        lastInvalid ?? {
          decisionId: `pdec_${randomUUID()}`,
          definitionId: definition.id,
          definitionVersion: definition.version,
          provider: 'none',
          latencyMs: Date.now() - t0,
          summary: 'No provider produced a usable result.',
          policyVersion: execution.policyVersion ?? definition.policyVersion,
          inputDigest,
          traceId: execution.traceId,
          usage: { known: false },
          status: 'unavailable',
          reason: 'No provider available',
          code: 'no_provider',
        }
      );
    },
  };
}
