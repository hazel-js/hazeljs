/**
 * Agent OS Phase 4 — Agent DNA (.dna export/import) + marketplace package shape
 */

export interface AgentDnaTool {
  name: string;
  description?: string;
  parameters?: unknown;
  requiresApproval?: boolean;
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
}): AgentDna {
  return {
    format: 'hazeljs.agent.dna',
    version: input.version ?? '1.0.0',
    name: input.name,
    description: input.description,
    systemPrompt: input.systemPrompt,
    model: input.model,
    tools: input.tools ?? [],
    policies: input.policies,
    contracts: input.contracts,
    metadata: input.metadata,
    exportedAt: new Date().toISOString(),
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
