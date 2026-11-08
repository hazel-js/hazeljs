/**
 * Autonomous Application Runtime — core contracts (no runtime deps).
 */

export type AutonomousMode =
  | 'disabled'
  | 'observe-only'
  | 'suggest'
  | 'approval-required'
  | 'governed-auto';

export type CapabilityEffect = 'read-only' | 'idempotent' | 'reversible' | 'irreversible';

export type CapabilityApproval = 'auto' | 'required' | 'policy';

export type AutonomousBackoff = 'none' | 'fixed' | 'exponential';

export interface AutonomousLimits {
  maxDecisionsPerHour?: number;
  maxConcurrentRuns?: number;
  maxCostUsdPerDay?: number;
  maxActionsPerRun?: number;
}

export interface AutonomousRetryConfig {
  attempts?: number;
  backoff?: AutonomousBackoff;
  delayMs?: number;
}

export interface AutonomousRecoveryConfig {
  retry?: AutonomousRetryConfig;
}

export interface AutonomousLoopProtection {
  maxDepth?: number;
  cooldownMs?: number;
  maxActionsPerRun?: number;
}

export interface AutonomousOptions {
  id?: string;
  objective?: string;
  mode?: AutonomousMode;
  /** Explicit capability grants. Default: none (deny). */
  capabilities?: string[];
  /** Policy identifiers evaluated by the autonomous runtime. */
  policies?: string[];
  limits?: AutonomousLimits;
  recovery?: AutonomousRecoveryConfig;
  loopProtection?: AutonomousLoopProtection;
}

export interface ObserveOptions {
  /** Event type / topic to observe. */
  event: string;
  /** Optional schema version for the observation payload. */
  schemaVersion?: number;
  /** When true, skip starting a run (record only). */
  recordOnly?: boolean;
}

export interface CapabilityOptions {
  id: string;
  description?: string;
  version?: string;
  effect?: CapabilityEffect;
  approval?: CapabilityApproval;
  timeoutMs?: number;
  permissions?: string[];
  /** Require provider-backed idempotency or reconciliation for retries. */
  idempotencyKey?: string | true;
  /** Method name of a reconciliation handler on the same class. */
  reconcile?: string;
  /** Method name of a compensate handler (for reversible effects). */
  compensate?: string;
  concurrencyLimit?: number;
  costClass?: 'free' | 'low' | 'medium' | 'high';
  audit?: 'full' | 'redacted' | 'none';
}

export interface AutonomousObservation<T = unknown> {
  eventId: string;
  eventType: string;
  source: string;
  subject?: string;
  timestamp: string;
  correlationId?: string;
  causationId?: string;
  tenantId?: string;
  schemaVersion: number;
  payload: T;
  /** Trusted depth for loop protection (framework-set). */
  depth?: number;
}

export type AutonomousDecision =
  | { type: 'no-action'; reason: string }
  | { type: 'recommend'; recommendation: string; reason?: string }
  | {
      type: 'request-approval';
      capabilityId: string;
      arguments: unknown;
      reason: string;
    }
  | {
      type: 'execute';
      capabilityId: string;
      arguments: unknown;
      reason: string;
    };

export interface AutonomousDecisionContext {
  observation: AutonomousObservation;
  serviceId: string;
  objective?: string;
  mode: AutonomousMode;
  allowedCapabilities: string[];
  policies: string[];
  remainingBudgets?: Record<string, number>;
  priorRunState?: unknown;
  historicalObservations?: AutonomousObservation[];
}

export interface AutonomousDecisionEngine {
  evaluate(context: AutonomousDecisionContext): Promise<AutonomousDecision>;
}

export interface AutonomousOutcome {
  success: boolean;
  metrics?: Record<string, number>;
  recommendations?: string[];
  reason?: string;
}

export interface AutonomousOutcomeEvaluator {
  evaluate(run: unknown, observations: AutonomousObservation[]): Promise<AutonomousOutcome>;
}

export interface AutonomousRuntimePort {
  ingest(observation: AutonomousObservation): Promise<string | undefined>;
  resume(runId: string, approval: { approved: boolean; actor: string }): Promise<void>;
  listRuns(filter?: { serviceId?: string; status?: string }): Promise<unknown[]>;
  inspect(runId: string): Promise<unknown | undefined>;
}

export interface AutonomousMetadata {
  options: Required<Pick<AutonomousOptions, 'mode'>> & AutonomousOptions;
  target: NewableFunction;
}

export interface ObserveMetadata {
  event: string;
  schemaVersion: number;
  recordOnly: boolean;
  propertyKey: string;
  method: (...args: unknown[]) => unknown;
}

export interface CapabilityMetadata extends CapabilityOptions {
  propertyKey: string;
  method: (...args: unknown[]) => unknown;
  agentClass: NewableFunction;
}

type NewableFunction = new (...args: unknown[]) => unknown;
