/**
 * A2A Agent Card Builder
 *
 * Generates an A2A-compliant AgentCard from HazelJS @Agent decorator metadata.
 * This enables automatic discovery of HazelJS agents by other A2A-compatible
 * systems (e.g., Google ADK, other agent frameworks).
 *
 * @example
 * ```ts
 * const card = buildAgentCard(runtime, {
 *   url: 'https://api.example.com/a2a',
 *   provider: { organization: 'Acme Corp' },
 * });
 * // Serve at /.well-known/agent.json
 * ```
 */

import type { A2AAgentCard, A2ASkill, A2ACapabilities } from './a2a.types';
import type { AgentMetadata } from '../types/agent.types';
import type { ToolMetadata } from '../types/tool.types';

export interface AgentCardOptions {
  /** URL where the agent accepts A2A requests */
  url: string;
  /** Provider / organization info */
  provider?: { organization: string; url?: string };
  /** Version string */
  version?: string;
  /** Documentation URL */
  documentationUrl?: string;
  /** Override capabilities */
  capabilities?: Partial<A2ACapabilities>;
  /** Default input modes */
  defaultInputModes?: string[];
  /** Default output modes */
  defaultOutputModes?: string[];
  /** Authentication requirements */
  authentication?: { schemes: string[]; credentials?: string };
}

/** Minimal runtime interface to avoid circular deps */
interface RuntimeLike {
  getAgents(): string[];
  getAgentMetadata(name: string): AgentMetadata | undefined;
  getAgentTools(name: string): ToolMetadata[];
}

/**
 * Build an A2A AgentCard from a HazelJS AgentRuntime.
 *
 * Scans all registered agents and their tools, converting them into
 * A2A skills. Each agent becomes a skill, and its tools become
 * example capabilities listed in the skill description.
 */
export function buildAgentCard(runtime: RuntimeLike, options: AgentCardOptions): A2AAgentCard {
  const agentNames = runtime.getAgents();

  // Use the first agent's metadata for top-level card info,
  // or fall back to generic info
  const primaryMeta = agentNames.length > 0 ? runtime.getAgentMetadata(agentNames[0]) : undefined;

  const skills: A2ASkill[] = agentNames.map((name) => {
    const meta = runtime.getAgentMetadata(name);
    const tools = runtime.getAgentTools(name);

    return agentToSkill(name, meta, tools);
  });

  return {
    name: primaryMeta?.name ?? 'HazelJS Agent',
    description: primaryMeta?.description ?? 'A HazelJS-powered AI agent',
    url: options.url,
    provider: options.provider,
    version: options.version ?? '1.0.0',
    documentationUrl: options.documentationUrl,
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
      ...(options.capabilities ?? {}),
    },
    authentication: options.authentication,
    defaultInputModes: options.defaultInputModes ?? ['text'],
    defaultOutputModes: options.defaultOutputModes ?? ['text'],
    skills,
  };
}

/**
 * Build an A2A AgentCard for a single agent (when serving one agent per endpoint).
 */
export function buildSingleAgentCard(
  agentMeta: AgentMetadata,
  tools: ToolMetadata[],
  options: AgentCardOptions
): A2AAgentCard {
  const skill = agentToSkill(agentMeta.name, agentMeta, tools);

  return {
    name: agentMeta.name,
    description: agentMeta.description ?? `AI Agent: ${agentMeta.name}`,
    url: options.url,
    provider: options.provider,
    version: options.version ?? '1.0.0',
    documentationUrl: options.documentationUrl,
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
      ...(options.capabilities ?? {}),
    },
    authentication: options.authentication,
    defaultInputModes: options.defaultInputModes ?? ['text'],
    defaultOutputModes: options.defaultOutputModes ?? ['text'],
    skills: [skill],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function agentToSkill(
  name: string,
  meta: AgentMetadata | undefined,
  tools: ToolMetadata[]
): A2ASkill {
  const toolDescriptions = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');

  const description = meta?.description
    ? tools.length > 0
      ? `${meta.description}\n\nAvailable tools:\n${toolDescriptions}`
      : meta.description
    : `Agent: ${name}`;

  return {
    id: name,
    name,
    description,
    tags: meta?.policies ?? [],
    examples: meta?.systemPrompt ? [meta.systemPrompt.slice(0, 200)] : [],
    inputModes: ['text'],
    outputModes: ['text'],
  };
}
