/**
 * Agent OS Phase 4 — Agent DNA (.dna export/import) + marketplace package shape
 */

export interface AgentDnaTool {
  name: string;
  description?: string;
  parameters?: unknown;
  requiresApproval?: boolean;
}

export type AgentAutonomy = 'low' | 'medium' | 'high';

export type AgentScheduleKind = 'always' | 'hourly' | 'daily' | 'event' | 'manual';

export interface AgentDnaIdentity {
  name?: string;
  role?: string;
  description?: string;
}

export interface AgentDnaMission {
  goal: string;
  instructions?: string[];
}

export interface AgentDnaModel {
  provider?: string;
  model?: string;
  temperature?: number;
}

export interface AgentDnaMemory {
  enabled: boolean;
  strategy?: string;
}

export interface AgentDnaSlo {
  successRate?: number;
  maxResponseTimeMs?: number;
  maxCostPerRun?: number;
}

export interface AgentDnaSchedule {
  kind: AgentScheduleKind;
  /** Cron expression or `HH:mm` for daily. */
  cron?: string;
  event?: string;
  timezone?: string;
}

/** Risk level for a declared decision (trusted config — never model-authored). */
export type AgentDnaDecisionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AgentDnaDecisionStrategyMode =
  | 'auto'
  | 'fast'
  | 'standard'
  | 'deliberate'
  | 'human-required'
  | 'rules';

export type AgentDnaDecisionPolicyAction =
  | 'allow'
  | 'deny'
  | 'critique'
  | 'review'
  | 'escalate'
  | 'fallback';

/** Declarative Decision DNA nested under an Agent DNA document. */
export interface AgentDnaDecision {
  /** Semantic version of this decision definition (e.g. "3"). */
  version?: string;
  objective: string;
  choices: string[];
  risk?:
    | AgentDnaDecisionRiskLevel
    | {
        level: AgentDnaDecisionRiskLevel;
        impact?: string;
        reversible?: boolean;
      };
  strategy?:
    | AgentDnaDecisionStrategyMode
    | {
        mode: AgentDnaDecisionStrategyMode;
      };
  provider?: string;
  /** Confidence band thresholds (heuristic / ensemble — not calibrated by default). */
  confidence?: {
    high?: number;
    medium?: number;
  };
  /** Deterministic post-decision policy rules (evaluated in code, not by a model). */
  policy?: Array<{
    when?: {
      risk?: AgentDnaDecisionRiskLevel;
      confidence?: { gte?: number; lt?: number; lte?: number; gt?: number };
    };
    action: AgentDnaDecisionPolicyAction;
  }>;
  /** Required evidence keys / state paths (missing → evidence gaps). */
  evidence?: {
    required?: string[];
    projections?: Array<{
      key: string;
      from: string;
      /** Optional transform: delta vs another path, ratio, or boolean threshold. */
      transform?:
        | { type: 'value' }
        | { type: 'delta'; against: string }
        | { type: 'ratio'; against: string }
        | { type: 'boolean'; gte?: number; gt?: number; lte?: number; lt?: number };
      relevance?: number;
    }>;
  };
  /** Weighted evidence keys that support each candidate (offline scoring). */
  scoring?: Record<
    string,
    Array<{ evidenceKey: string; weight: number; when?: 'present' | 'truthy' | 'gt0' }>
  >;
  /** Tie-break preference when candidate scores are equal. */
  onTie?: string;
  /** Map choice → capability / HITL. */
  execution?: Record<
    string,
    {
      capability?: string;
      hitl?: boolean;
    }
  >;
  slo?: {
    p95LatencyMs?: number;
    maxReviewRate?: number;
    maxFailureRate?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface AgentDna {
  format: 'hazeljs.agent.dna';
  version: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  tools: AgentDnaTool[];
  policies?: unknown[];
  contracts?: unknown[];
  metadata?: Record<string, unknown>;
  exportedAt: string;
  /** Who the agent is (optional; falls back to name/description). */
  identity?: AgentDnaIdentity;
  /** What the agent should accomplish (optional; maps to systemPrompt when absent). */
  mission?: AgentDnaMission;
  /** Structured model selection (optional; `model` string remains canonical). */
  modelConfig?: AgentDnaModel;
  autonomy?: AgentAutonomy;
  memory?: AgentDnaMemory;
  slo?: AgentDnaSlo;
  schedule?: AgentDnaSchedule;
  /**
   * Optional Decision DNA map (name → definition).
   * Consumed by `@hazeljs/decision`. Omitted documents remain valid.
   */
  decisions?: Record<string, AgentDnaDecision>;
}

export interface MarketplaceAgentPackage {
  name: string;
  version: string;
  description?: string;
  dna: AgentDna;
  readme?: string;
  keywords?: string[];
}

export function exportAgentDna(input: {
  name: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  tools?: AgentDnaTool[];
  policies?: unknown[];
  contracts?: unknown[];
  metadata?: Record<string, unknown>;
  version?: string;
  identity?: AgentDnaIdentity;
  mission?: AgentDnaMission;
  modelConfig?: AgentDnaModel;
  autonomy?: AgentAutonomy;
  memory?: AgentDnaMemory;
  slo?: AgentDnaSlo;
  schedule?: AgentDnaSchedule;
  decisions?: Record<string, AgentDnaDecision>;
}): AgentDna {
  const missionGoal = input.mission?.goal;
  return {
    format: 'hazeljs.agent.dna',
    version: input.version ?? '1.0.0',
    name: input.name,
    description: input.description ?? input.identity?.description,
    systemPrompt:
      input.systemPrompt ??
      (missionGoal ? `You are ${input.name}. Mission: ${missionGoal}` : undefined),
    model: input.model ?? input.modelConfig?.model,
    tools: input.tools ?? [],
    policies: input.policies,
    contracts: input.contracts,
    metadata: input.metadata,
    exportedAt: new Date().toISOString(),
    identity: input.identity,
    mission: input.mission,
    modelConfig: input.modelConfig,
    autonomy: input.autonomy,
    memory: input.memory,
    slo: input.slo,
    schedule: input.schedule,
    decisions: input.decisions,
  };
}

export function serializeDna(dna: AgentDna): string {
  return JSON.stringify(dna, null, 2);
}

export function parseDna(raw: string | AgentDna): AgentDna {
  const dna = typeof raw === 'string' ? (JSON.parse(raw) as AgentDna) : raw;
  if (dna.format !== 'hazeljs.agent.dna') {
    throw new Error(`Invalid DNA format: ${String((dna as { format?: string }).format)}`);
  }
  if (!dna.name) throw new Error('DNA missing name');
  return dna;
}

export function toMarketplacePackage(
  dna: AgentDna,
  extras?: { readme?: string; keywords?: string[] }
): MarketplaceAgentPackage {
  return {
    name: `@hazeljs/${dna.name}-agent`,
    version: dna.version,
    description: dna.description,
    dna,
    readme: extras?.readme,
    keywords: extras?.keywords ?? ['hazeljs', 'agent', 'dna'],
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Validate MarketplaceAgentPackage shape (G2 Package+Store schema freeze).
 * Source of truth: these TypeScript types — no separate @hazeljs/agent-manifest yet.
 */
export function validateMarketplacePackage(pkg: unknown): ValidationResult {
  const errors: string[] = [];
  if (pkg === null || typeof pkg !== 'object') {
    return { ok: false, errors: ['Package must be an object'] };
  }
  const p = pkg as Record<string, unknown>;
  if (typeof p.name !== 'string' || !p.name.trim()) {
    errors.push('Package missing name');
  }
  if (typeof p.version !== 'string' || !p.version.trim()) {
    errors.push('Package missing version');
  }
  if (p.dna === undefined || p.dna === null) {
    errors.push('Package missing dna');
  } else {
    try {
      parseDna(p.dna as AgentDna);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (p.keywords !== undefined && !Array.isArray(p.keywords)) {
    errors.push('Package keywords must be an array');
  }
  return { ok: errors.length === 0, errors };
}

/** Assert package is valid or throw with joined errors. */
export function assertValidMarketplacePackage(
  pkg: unknown
): asserts pkg is MarketplaceAgentPackage {
  const result = validateMarketplacePackage(pkg);
  if (!result.ok) {
    throw new Error(`Invalid marketplace package: ${result.errors.join('; ')}`);
  }
}
