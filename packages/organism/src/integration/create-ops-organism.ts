/**
 * Boilerplate factory for ops-style organisms used by product platforms.
 */

import type { CreateOrganismOptions } from '../core/organism-runtime';
import { createOrganismHost, type OrganismHost } from '../host/organism-host';
import { incidentNeedMappings } from '../bridge/signal-bridge';
import type {
  AgentGeneDefinition,
  ConstitutionDefinition,
  MissionDefinition,
  MissionMetric,
  OrganismLimits,
  ResourceDefinition,
  SignalNeedMapping,
} from '../types/organism.types';
import { DEFAULT_ORGANISM_LIMITS } from '../types/organism.types';
import type { OrganismRepository } from '../persistence/organism-repository';

export interface CreateOpsOrganismOptions {
  id?: string;
  mission:
    | MissionDefinition
    | {
        id: string;
        objective: string;
        successCriteria?: MissionMetric[];
        constraints?: string[];
      };
  genes: AgentGeneDefinition[];
  constitution?: ConstitutionDefinition;
  /** Direct signal→need mappings from the vertical pack. */
  signalNeedMappings?: SignalNeedMapping[];
  /** Incident types detected outside organism (e.g. refund_spike). */
  incidentTypes?: string[];
  /** Capabilities used when routing incident.* observations. */
  investigationCapabilities?: string[];
  limits?: Partial<OrganismLimits>;
  resources?: ResourceDefinition;
  repository?: OrganismRepository;
  simulation?: boolean;
  debug?: boolean;
}

/**
 * Create an organism configured for autonomous operations embedding.
 * Does not include vertical detectors/policies — those stay in the product layer.
 */
export async function createOpsOrganism(options: CreateOpsOrganismOptions): Promise<OrganismHost> {
  const investigationCaps = options.investigationCapabilities ??
    options.genes.find((g) => g.capabilities.length > 0)?.capabilities ?? ['operations'];

  const incidentMappings = incidentNeedMappings(options.incidentTypes ?? [], investigationCaps);

  const createOptions: CreateOrganismOptions = {
    id: options.id,
    mission: {
      id: options.mission.id,
      objective: options.mission.objective,
      successCriteria: options.mission.successCriteria,
      constraints: options.mission.constraints,
    },
    genes: options.genes,
    constitution: options.constitution,
    signalNeedMappings: [...(options.signalNeedMappings ?? []), ...incidentMappings],
    limits: {
      ...DEFAULT_ORGANISM_LIMITS,
      ...options.limits,
    },
    resources: options.resources ?? {
      tokenBudget: 500_000,
      maxConcurrentAgents: options.limits?.maxAgents ?? DEFAULT_ORGANISM_LIMITS.maxAgents,
    },
    repository: options.repository,
    simulation: options.simulation ?? false,
    debug: options.debug ?? false,
  };

  return createOrganismHost(createOptions);
}
