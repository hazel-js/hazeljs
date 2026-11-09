import type {
  AutonomousLoopProtection,
  AutonomousMode,
  AutonomousObservation,
  AutonomousDecision,
  CapabilityEffect,
} from '@hazeljs/core';

export type AarPhase =
  | 'created'
  | 'observing'
  | 'evaluating'
  | 'decision_recorded'
  | 'approval_pending'
  | 'ready_to_execute'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'retry_wait'
  | 'compensating'
  | 'cancelled'
  | 'expired'
  | 'reconcile';

export interface AarRunMetadata {
  kind: 'autonomous';
  serviceId: string;
  phase: AarPhase;
  mode: AutonomousMode;
  observation?: AutonomousObservation;
  decision?: AutonomousDecision;
  capabilityId?: string;
  approvalId?: string;
  timeline?: AarTimelineEvent[];
  effectStatus?: 'pending' | 'succeeded' | 'failed' | 'uncertain';
  dryRun?: boolean;
}

export interface AarTimelineEvent {
  at: string;
  type: string;
  detail?: string;
  data?: Record<string, unknown>;
}

export interface RegisteredCapability {
  id: string;
  version: string;
  serviceId: string;
  effect: CapabilityEffect;
  approval: 'auto' | 'required' | 'policy';
  propertyKey: string;
  instance: object;
  method: (...args: unknown[]) => unknown;
  idempotencyKey?: string | true;
  reconcile?: string;
  compensate?: string;
  granted: boolean;
}

export interface RegisteredAutonomousService {
  id: string;
  className: string;
  mode: AutonomousMode;
  objective?: string;
  capabilities: string[];
  policies: string[];
  loopProtection: Required<AutonomousLoopProtection>;
  instance: object;
  target: new (...args: unknown[]) => unknown;
}

export interface AutonomousModuleOptions {
  /** Durable run repository — defaults to in-memory AgentRun repository. */
  storage?: AutonomousRunStore;
  /** Decision engine — defaults to rules/heuristic engine (no LLM). */
  decisionEngine?: import('@hazeljs/core').AutonomousDecisionEngine;
  capabilities?: {
    defaultPolicy?: 'deny' | 'allow';
  };
  observability?: {
    enabled?: boolean;
  };
  loopProtection?: AutonomousLoopProtection;
  /** Optional Gatekeeper instance; created with default-deny if omitted. */
  gatekeeper?: import('@hazeljs/agent-gatekeeper').AgentGatekeeper;
  /** Auto-discover @Autonomous classes from global registry. Default true. */
  autoDiscover?: boolean;
  /** Explicit service classes to register. */
  services?: Array<new (...args: unknown[]) => unknown>;
  /** Trusted tenant resolver for observations (never from model args). */
  resolveTenantId?: (observation: AutonomousObservation) => string | undefined;
  /** Simulation / dry-run barrier — when true, no live side effects. */
  simulation?: boolean;
}

export interface AutonomousRunStore {
  create(input: {
    id: string;
    serviceId: string;
    input?: unknown;
    tenantId?: string;
    metadata: AarRunMetadata;
  }): Promise<AutonomousRunRecord>;
  get(runId: string): Promise<AutonomousRunRecord | undefined>;
  update(
    runId: string,
    patch: {
      status?: string;
      output?: unknown;
      error?: { message: string; code?: string };
      metadata?: AarRunMetadata;
    }
  ): Promise<AutonomousRunRecord>;
  list(filter?: { serviceId?: string; status?: string }): Promise<AutonomousRunRecord[]>;
}

export interface AutonomousRunRecord {
  id: string;
  serviceId: string;
  status: string;
  input?: unknown;
  output?: unknown;
  error?: { message: string; code?: string };
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: AarRunMetadata;
}

export const DEFAULT_LOOP_PROTECTION: Required<AutonomousLoopProtection> = {
  maxDepth: 5,
  cooldownMs: 5000,
  maxActionsPerRun: 10,
};
