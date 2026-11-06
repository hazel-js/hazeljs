/**
 * Versioned decision definitions for the provider-neutral Decision Plane.
 * Additive — does not replace DecisionRuntime / AgentDnaDecision.
 */

export type PlaneFailureBehavior = 'abstain' | 'escalate' | 'review' | 'unavailable';

export interface PlaneBudget {
  maxUsd?: number;
  maxTokens?: number;
}

export interface PlaneCacheConfig {
  /** Opt-in. Off by default for security-critical definitions. */
  enabled?: boolean;
  ttlMs?: number;
}

export interface PlaneProviderStrategy {
  /** Ordered provider names. Fallback cannot widen answers. */
  providers: readonly string[];
  onFailure?: PlaneFailureBehavior;
  /** Bounded retries for timeout / rate-limit only. */
  maxRetries?: number;
  retryBaseMs?: number;
}

export interface DecisionDefinition<TAnswers extends readonly string[] = readonly string[]> {
  readonly id: string;
  readonly version: string;
  readonly domain?: string;
  readonly description?: string;
  readonly answers: TAnswers;
  readonly criteria: { readonly [K in TAnswers[number]]: string };
  readonly timeoutMs?: number;
  readonly budget?: PlaneBudget;
  readonly strategy?: PlaneProviderStrategy;
  readonly cache?: PlaneCacheConfig;
  readonly policyVersion?: string;
  /**
   * When true, caching is refused even if cache.enabled is set.
   * Used for tool-risk and memory-promotion decisions.
   */
  readonly securityCritical?: boolean;
}

export type InferAnswers<T> = T extends DecisionDefinition<infer A> ? A[number] : string;

export function defineDecision<const TAnswers extends readonly string[]>(def: {
  id: string;
  version: string;
  domain?: string;
  description?: string;
  answers: TAnswers;
  criteria: { [K in TAnswers[number]]: string };
  timeoutMs?: number;
  budget?: PlaneBudget;
  strategy?: PlaneProviderStrategy;
  cache?: PlaneCacheConfig;
  policyVersion?: string;
  securityCritical?: boolean;
}): DecisionDefinition<TAnswers> {
  if (!def.id?.trim()) {
    throw new Error('defineDecision: id is required');
  }
  if (!def.version?.trim()) {
    throw new Error('defineDecision: version is required');
  }
  if (!def.answers?.length) {
    throw new Error('defineDecision: answers must be a non-empty finite set');
  }
  for (const answer of def.answers) {
    if (!(answer in def.criteria)) {
      throw new Error(`defineDecision: missing criteria for answer "${answer}"`);
    }
  }
  return Object.freeze({
    id: def.id,
    version: def.version,
    domain: def.domain,
    description: def.description,
    answers: Object.freeze([...def.answers]) as TAnswers,
    criteria: Object.freeze({ ...def.criteria }) as DecisionDefinition<TAnswers>['criteria'],
    timeoutMs: def.timeoutMs,
    budget: def.budget ? Object.freeze({ ...def.budget }) : undefined,
    strategy: def.strategy
      ? Object.freeze({
          ...def.strategy,
          providers: Object.freeze([...def.strategy.providers]),
        })
      : undefined,
    cache: def.cache ? Object.freeze({ ...def.cache }) : undefined,
    policyVersion: def.policyVersion,
    securityCritical: def.securityCritical,
  });
}
