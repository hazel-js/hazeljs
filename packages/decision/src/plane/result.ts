/**
 * Discriminated PlaneResult union and authenticated execution context.
 */

import type { DecisionDefinition } from './definition';

/** Server-built identity. Tool/model arguments must never set these fields. */
export interface PlaneExecutionContext {
  readonly tenantId: string;
  readonly actorId: string;
  /** Fingerprint of permitted capabilities / roles (not raw secrets). */
  readonly permissionScope: string;
  readonly runId?: string;
  readonly capabilities?: readonly string[];
  readonly policyVersion?: string;
  readonly traceId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type PlaneUsage =
  | { known: false }
  | {
      known: true;
      inputTokens?: number;
      outputTokens?: number;
      costUsd?: number;
    };

export interface PlaneResultBase {
  readonly decisionId: string;
  readonly definitionId: string;
  readonly definitionVersion: string;
  readonly provider: string;
  readonly model?: string;
  readonly latencyMs: number;
  /** Bounded explanatory summary — not private model reasoning. */
  readonly summary: string;
  readonly policyVersion?: string;
  readonly inputDigest: string;
  readonly traceId?: string;
  readonly usage: PlaneUsage;
  /** Only when the provider supplies a meaningfully defined score. */
  readonly confidence?: number;
}

export type PlaneResult<TAnswer extends string = string> =
  | (PlaneResultBase & {
      status: 'succeeded';
      answer: TAnswer;
    })
  | (PlaneResultBase & {
      status: 'abstained';
      reason: string;
    })
  | (PlaneResultBase & {
      status: 'timed_out';
      reason: string;
    })
  | (PlaneResultBase & {
      status: 'unavailable';
      reason: string;
      code: string;
    })
  | (PlaneResultBase & {
      status: 'invalid';
      reason: string;
      rawAnswer?: string;
    });

export interface PlaneDecideRequest<
  TAnswers extends readonly string[] = readonly string[],
  TContext = unknown,
> {
  definition: DecisionDefinition<TAnswers>;
  context: TContext;
  execution: PlaneExecutionContext;
  /** Optional AbortSignal; combined with definition.timeoutMs. */
  signal?: AbortSignal;
}

export type PlaneCapabilityStatus = 'available' | 'inject_only' | 'unavailable';

export interface PlaneProviderCapabilities {
  name: string;
  status: PlaneCapabilityStatus;
  notes?: string;
}
