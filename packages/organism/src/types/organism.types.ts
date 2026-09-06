/**
 * @hazeljs/organism — core type definitions
 */

export type OrganismStatus =
  | 'created'
  | 'initializing'
  | 'observing'
  | 'planning'
  | 'operating'
  | 'degraded'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'terminated';

export type RuntimeAgentStatus =
  | 'conceived'
  | 'initializing'
  | 'active'
  | 'idle'
  | 'specializing'
  | 'reproducing'
  | 'suspended'
  | 'termination-pending'
  | 'terminated'
  | 'failed';

export type MissionMetricOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'maximize' | 'minimize';

export interface MissionMetric {
  name: string;
  operator: MissionMetricOperator;
  target?: number;
  weight?: number;
}

export interface MissionPriority {
  name: string;
  weight: number;
}

export interface MissionDefinition {
  id: string;
  objective: string;
  description?: string;
  horizon?: string | number;
  successCriteria?: MissionMetric[];
  constraints?: string[];
  priorities?: MissionPriority[];
  metadata?: Record<string, unknown>;
}

export interface ResourceLimits {
  tokens?: number;
  money?: { amount: number; currency: string };
  computeUnits?: number;
  toolCalls?: number;
  maxConcurrentAgents?: number;
}

export interface AgentGeneDefinition {
  id: string;
  description?: string;
  capabilities: string[];
  tools?: unknown[];
  initialPrompt?: string;
  policies?: string[];
  resourceLimits?: ResourceLimits;
  reproduction?: {
    enabled: boolean;
    maxChildren?: number;
  };
  mutation?: {
    enabled: boolean;
    allowedProperties?: string[];
  };
}

export type ConstitutionSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ConstitutionRule {
  id: string;
  rule: string;
  severity: ConstitutionSeverity;
}

export interface ConstitutionDefinition {
  id: string;
  rules: ConstitutionRule[];
  description?: string;
}

export interface EnvironmentSignal {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: unknown;
  severity?: number;
  relevance?: number;
}

export interface EnvironmentSourceDefinition {
  id: string;
  publish?: (signal: EnvironmentSignal) => void | Promise<void>;
}

export interface EnvironmentDefinition {
  id: string;
  sources?: EnvironmentSourceDefinition[];
  description?: string;
}

export interface ResourceDefinition {
  id?: string;
  monthlyBudget?: { amount: number; currency: string };
  tokenBudget?: number;
  maxConcurrentAgents?: number;
  computeUnits?: number;
  toolCalls?: number;
}

export interface OrganismLimits {
  maxAgents: number;
  maxGenerationDepth: number;
  maxChildrenPerAgent: number;
  maxSpawnRatePerMinute: number;
  maxTotalCostPerHour: number;
}

export interface OrganismCycleConfig {
  perception?: string | number;
  evaluation?: string | number;
  survival?: string | number;
  missionEvaluation?: string | number;
  resourceAllocation?: string | number;
}

export interface AgentResourceWallet {
  tokensRemaining?: number;
  moneyRemaining?: { amount: number; currency: string };
  computeUnitsRemaining?: number;
  toolCallsRemaining?: number;
}

export interface AgentReputation {
  agentId: string;
  score: number;
  dimensions: {
    usefulness: number;
    reliability: number;
    efficiency: number;
    policyCompliance: number;
    collaboration: number;
  };
}

export interface UtilityScore {
  score: number;
  valueGenerated: number;
  cost: number;
  riskPenalty: number;
  confidence: number;
}

export interface UtilityWeights {
  missionContribution: number;
  reliability: number;
  efficiency: number;
  policyCompliance: number;
  collaboration: number;
}

export const DEFAULT_UTILITY_WEIGHTS: UtilityWeights = {
  missionContribution: 0.35,
  reliability: 0.2,
  efficiency: 0.2,
  policyCompliance: 0.15,
  collaboration: 0.1,
};

export const DEFAULT_ORGANISM_LIMITS: OrganismLimits = {
  maxAgents: 25,
  maxGenerationDepth: 5,
  maxChildrenPerAgent: 3,
  maxSpawnRatePerMinute: 5,
  maxTotalCostPerHour: 10,
};

export interface AgentGenealogy {
  agentId: string;
  parentAgentId?: string;
  rootGeneId: string;
  generation: number;
  children: string[];
  createdAt: Date;
  terminatedAt?: Date;
}

export interface AgentMutation {
  promptChanges?: string[];
  addedCapabilities?: string[];
  removedCapabilities?: string[];
  modelConfig?: Record<string, unknown>;
  strategyConfig?: Record<string, unknown>;
}

export interface AgentBirthProposal {
  reason: string;
  needId: string;
  requiredCapabilities: string[];
  expectedOutcome: string;
  estimatedCost?: number;
  expectedUtility?: number;
  terminationCriteria?: string[];
  confidence: number;
  geneId?: string;
  specialize?: string[];
  parentAgentId?: string;
}

export interface DetectedNeed {
  need: string;
  reason: string;
  requiredCapabilities: string[];
  urgency: number;
  confidence: number;
  signalId?: string;
}

export type OrganismDecisionAction =
  | 'delegate'
  | 'spawn'
  | 'specialize'
  | 'reproduce'
  | 'terminate'
  | 'reallocate'
  | 'observe';

export interface ResourceRequest {
  tokens?: number;
  money?: number;
  computeUnits?: number;
  toolCalls?: number;
}

export interface OrganismDecision {
  action: OrganismDecisionAction;
  reasoningSummary: string;
  confidence: number;
  targetAgentId?: string;
  requiredCapabilities?: string[];
  resourceRequest?: ResourceRequest;
  birthProposal?: AgentBirthProposal;
  needId?: string;
}

export interface AgentOutcomeReport {
  taskId?: string;
  result: string;
  metrics?: {
    valueGenerated?: number;
    confidence?: number;
    cost?: number;
    riskPenalty?: number;
    [key: string]: number | undefined;
  };
  evidence?: string[];
  missionMetricUpdates?: Record<string, number>;
}

export interface RuntimeAgentRecord {
  id: string;
  name: string;
  objective: string;
  capabilities: string[];
  geneId: string;
  parentAgentId?: string;
  generation: number;
  status: RuntimeAgentStatus;
  reputation: AgentReputation;
  utility: UtilityScore;
  wallet: AgentResourceWallet;
  birthProposal: AgentBirthProposal;
  terminationCriteria: string[];
  createdAt: Date;
  terminatedAt?: Date;
  evaluationCount: number;
  lastEvaluatedAt?: Date;
  criticalResponsibility: boolean;
  costConsumed: number;
  tokensConsumed: number;
  valueGenerated: number;
  specialize?: string[];
  dnaAgentName: string;
  /** Inherited / mutable system prompt fragment. */
  systemPrompt?: string;
  /** Capability grants / permission tags — child must be subset of parent. */
  permissions: string[];
  /** Safe strategy configuration (mutable under mutation policy). */
  strategyConfig: Record<string, unknown>;
  /** Safe model preference config (mutable under mutation policy). */
  modelConfig: Record<string, unknown>;
  /** Auditable mutation history. */
  mutations: AgentMutationRecord[];
  /** Strategy cohort id for evolutionary evaluation. */
  strategyId?: string;
  lastReproductionAt?: Date;
  lastMutationAt?: Date;
}

export type InheritanceMemoryStrategy = 'none' | 'relevant-only' | 'all';

export interface InheritancePolicy {
  mission?: boolean;
  constitution?: boolean;
  permissions?: 'subset' | 'none' | 'copy';
  memory?: {
    strategy: InheritanceMemoryStrategy;
    maxItems?: number;
  };
  tools?: boolean;
  skills?: boolean;
  context?: boolean;
  strategies?: boolean;
  modelSettings?: boolean;
  resources?: {
    /** Fraction of parent wallet tokens/money transferred (0-1). Default 0.25. */
    transferFraction?: number;
  };
}

export const DEFAULT_INHERITANCE_POLICY: InheritancePolicy = {
  mission: true,
  constitution: true,
  permissions: 'subset',
  memory: { strategy: 'relevant-only', maxItems: 100 },
  tools: true,
  skills: true,
  context: false,
  strategies: true,
  modelSettings: true,
  resources: { transferFraction: 0.25 },
};

export interface ReproduceRequest {
  reason: string;
  specialization?: string[];
  objective?: string;
  needId?: string;
  inheritance?: InheritancePolicy;
  tokens?: number;
  confidence?: number;
  terminationCriteria?: string[];
}

export interface AgentMutationRecord {
  id: string;
  at: Date;
  mutation: AgentMutation;
  reason: string;
  parentStrategyId?: string;
  resultingStrategyId?: string;
}

export interface GenerationMemberScore {
  agentId: string;
  score: number;
  utility: number;
  reputation: number;
  cost: number;
  policyCompliance: number;
}

export interface GenerationEvaluationResult {
  populationId: string;
  winner: string;
  scores: Record<string, number>;
  members: GenerationMemberScore[];
  promotedStrategyId?: string;
}

export interface EvolutionaryHistoryEntry {
  at: Date;
  populationId: string;
  winnerAgentId: string;
  scores: Record<string, number>;
  promotedStrategyId?: string;
}

export interface MissionProgress {
  missionId: string;
  objective: string;
  metrics: Record<string, number>;
  criteriaMet: Record<string, boolean>;
  completed: boolean;
  updatedAt: Date;
}

export interface OrganismRecord {
  id: string;
  status: OrganismStatus;
  mission: MissionDefinition;
  constitution?: ConstitutionDefinition;
  environment?: EnvironmentDefinition;
  genes: AgentGeneDefinition[];
  resources: ResourceDefinition;
  limits: OrganismLimits;
  cycles: OrganismCycleConfig;
  missionProgress: MissionProgress;
  pool: {
    tokensRemaining: number;
    moneyRemaining: { amount: number; currency: string };
    costSpentThisHour: number;
  };
  debug: boolean;
  simulation: boolean;
  createdAt: Date;
  updatedAt: Date;
  emergencyStopped: boolean;
}

export interface OrganismGraphNode {
  id: string;
  label: string;
  status: RuntimeAgentStatus;
  generation: number;
  utility: number;
  reputation: number;
  cost: number;
  tokens: number;
  objective: string;
  geneId: string;
  parentId?: string;
}

export interface OrganismGraphEdge {
  from: string;
  to: string;
  kind: 'parent' | 'gene';
}

export interface OrganismGraph {
  nodes: OrganismGraphNode[];
  edges: OrganismGraphEdge[];
}

export interface OrganismInspectState {
  mission: MissionDefinition;
  missionProgress: MissionProgress;
  status: OrganismStatus;
  agents: Array<{
    id: string;
    objective: string;
    capabilities: string[];
    parentId?: string;
    generation: number;
    status: RuntimeAgentStatus;
    reputation: AgentReputation;
    utility: UtilityScore;
    resourceConsumption: { tokens: number; cost: number };
  }>;
  resources: {
    pool: OrganismRecord['pool'];
    limits: OrganismLimits;
  };
  recentSignals: EnvironmentSignal[];
  recentDecisions: OrganismDecision[];
  genealogy: AgentGenealogy[];
}

export interface SignalNeedMapping {
  signalType: string;
  need: string;
  requiredCapabilities: string[];
  urgency?: number;
  confidence?: number;
}

export interface SurvivalConfig {
  minimumUtility: number;
  minimumEvaluationAgeMs: number;
  minimumSampleSize: number;
  cooldownMs: number;
}

export const DEFAULT_SURVIVAL_CONFIG: SurvivalConfig = {
  minimumUtility: 0.2,
  minimumEvaluationAgeMs: 60_000,
  minimumSampleSize: 3,
  cooldownMs: 30_000,
};

export type SurvivalState =
  | 'healthy'
  | 'watch'
  | 'resource-reduced'
  | 'candidate-for-termination'
  | 'terminated';

/** Phase 4 — agent economy */

export type ResourceBidStatus = 'open' | 'won' | 'lost' | 'cancelled' | 'expired';

export interface ResourceBid {
  id: string;
  agentId: string;
  reason: string;
  requested: ResourceRequest;
  /** Estimated mission value if granted (absolute units). */
  expectedValue: number;
  confidence: number;
  urgency: number;
  /** Optional willingness-to-pay in pool money units. */
  bidPrice?: number;
  createdAt: Date;
  expiresAt?: Date;
  status: ResourceBidStatus;
}

export interface UtilityForecast {
  agentId: string;
  expectedUtility: number;
  expectedValue: number;
  estimatedCost: number;
  opportunityCost: number;
  netExpectedValue: number;
  confidence: number;
  reasoningSummary: string;
}

export interface OpportunityCostEstimate {
  tokens: number;
  money: number;
  /** Marginal value of scarce resources given current pool pressure. */
  scarcityMultiplier: number;
  total: number;
}

export interface MarketClearingResult {
  roundId: string;
  awarded: Array<{
    bidId: string;
    agentId: string;
    wallet: AgentResourceWallet;
    forecast: UtilityForecast;
  }>;
  denied: Array<{
    bidId: string;
    agentId: string;
    reason: string;
    forecast?: UtilityForecast;
  }>;
  opportunityCostTotal: number;
}

export interface NegotiationOffer {
  fromAgentId: string;
  toAgentId: string;
  reason: string;
  transfer: ResourceRequest;
  expectedValue?: number;
  confidence?: number;
}

export interface NegotiationResult {
  approved: boolean;
  reason: string;
  transfer?: ResourceRequest;
  fromWallet?: AgentResourceWallet;
  toWallet?: AgentResourceWallet;
}

export interface MarketConfig {
  /** Minimum net expected value (after opportunity cost) to win a bid. */
  minNetExpectedValue: number;
  /** Weight of bidPrice in clearing score (0-1). */
  priceWeight: number;
  /** Default bid TTL in ms. */
  defaultBidTtlMs: number;
  /** Scarcity kicks in when pool utilization exceeds this (0-1). */
  scarcityThreshold: number;
}

export const DEFAULT_MARKET_CONFIG: MarketConfig = {
  minNetExpectedValue: 0,
  priceWeight: 0.15,
  defaultBidTtlMs: 60_000,
  scarcityThreshold: 0.7,
};
