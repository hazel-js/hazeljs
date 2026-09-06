import type {
  AgentMutation,
  AgentOutcomeReport,
  AgentResourceWallet,
  ConstitutionDefinition,
  InheritancePolicy,
  MissionDefinition,
  NegotiationResult,
  OrganismDecision,
  ReproduceRequest,
  ResourceBid,
  ResourceRequest,
  RuntimeAgentRecord,
  UtilityForecast,
} from '../types/organism.types';
import { OrganismError } from '../errors/organism.errors';

/**
 * Controlled context exposed to agents — not full organism internals.
 */
export class OrganismAgentContext {
  constructor(
    private readonly api: {
      getMission: () => MissionDefinition;
      getConstitution: () => ConstitutionDefinition | undefined;
      getWallet: () => AgentResourceWallet;
      findAgents: (query: { capabilities?: string[] }) => Promise<RuntimeAgentRecord[]>;
      delegate: (input: { to: string; task: string }) => Promise<{ ok: boolean; result?: string }>;
      requestResources: (input: {
        reason: string;
        requested: ResourceRequest;
        expectedValue?: number;
        confidence?: number;
        urgency?: number;
        useMarket?: boolean;
      }) => Promise<{
        approved: boolean;
        reason: string;
        wallet?: AgentResourceWallet;
        forecast?: UtilityForecast;
      }>;
      placeBid?: (input: {
        reason: string;
        requested: ResourceRequest;
        expectedValue: number;
        confidence: number;
        urgency?: number;
        bidPrice?: number;
      }) => ResourceBid;
      negotiate?: (input: {
        toAgentId: string;
        reason: string;
        transfer: ResourceRequest;
        expectedValue?: number;
        confidence?: number;
      }) => Promise<NegotiationResult>;
      reportOutcome: (report: AgentOutcomeReport) => Promise<void>;
      requestApproval: (input: {
        action: string;
        reason: string;
        risk?: number;
        expectedValue?: number;
      }) => Promise<{ approved: boolean; reason: string }>;
      spawn: (input: {
        reason: string;
        objective: string;
        needId: string;
        requiredCapabilities: string[];
        specialize?: string[];
        tokens?: number;
      }) => Promise<RuntimeAgentRecord>;
      reproduce: (request: ReproduceRequest) => Promise<RuntimeAgentRecord>;
      mutate?: (input: { reason: string; mutation: AgentMutation }) => Promise<RuntimeAgentRecord>;
    }
  ) {}

  get mission(): MissionDefinition {
    return this.api.getMission();
  }

  get constitution(): ConstitutionDefinition | undefined {
    return this.api.getConstitution();
  }

  get resources(): AgentResourceWallet {
    return this.api.getWallet();
  }

  findAgents(query: { capabilities?: string[] }): Promise<RuntimeAgentRecord[]> {
    return this.api.findAgents(query);
  }

  delegate(input: { to: string; task: string }): Promise<{ ok: boolean; result?: string }> {
    return this.api.delegate(input);
  }

  requestResources(input: {
    reason: string;
    requested: ResourceRequest;
    expectedValue?: number;
    confidence?: number;
    urgency?: number;
    useMarket?: boolean;
  }): Promise<{
    approved: boolean;
    reason: string;
    wallet?: AgentResourceWallet;
    forecast?: UtilityForecast;
  }> {
    return this.api.requestResources(input);
  }

  placeBid(input: {
    reason: string;
    requested: ResourceRequest;
    expectedValue: number;
    confidence: number;
    urgency?: number;
    bidPrice?: number;
  }): ResourceBid {
    if (!this.api.placeBid) {
      throw new OrganismError('Bidding is not enabled on this context', 'NOT_IMPLEMENTED');
    }
    return this.api.placeBid(input);
  }

  negotiate(input: {
    toAgentId: string;
    reason: string;
    transfer: ResourceRequest;
    expectedValue?: number;
    confidence?: number;
  }): Promise<NegotiationResult> {
    if (!this.api.negotiate) {
      throw new OrganismError('Negotiation is not enabled on this context', 'NOT_IMPLEMENTED');
    }
    return this.api.negotiate(input);
  }

  reportOutcome(report: AgentOutcomeReport): Promise<void> {
    return this.api.reportOutcome(report);
  }

  requestApproval(input: {
    action: string;
    reason: string;
    risk?: number;
    expectedValue?: number;
  }): Promise<{ approved: boolean; reason: string }> {
    return this.api.requestApproval(input);
  }

  spawn(input: {
    reason: string;
    objective: string;
    needId: string;
    requiredCapabilities: string[];
    specialize?: string[];
    tokens?: number;
  }): Promise<RuntimeAgentRecord> {
    return this.api.spawn(input);
  }

  reproduce(request: ReproduceRequest): Promise<RuntimeAgentRecord> {
    return this.api.reproduce(request);
  }

  mutate(input: { reason: string; mutation: AgentMutation }): Promise<RuntimeAgentRecord> {
    if (!this.api.mutate) {
      throw new OrganismError('Mutation is not enabled on this context', 'NOT_IMPLEMENTED');
    }
    return this.api.mutate(input);
  }
}

export type { OrganismDecision, InheritancePolicy, ReproduceRequest };
