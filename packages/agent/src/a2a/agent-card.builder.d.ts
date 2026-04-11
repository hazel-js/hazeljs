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
import type { A2AAgentCard, A2ACapabilities } from './a2a.types';
import type { AgentMetadata } from '../types/agent.types';
import type { ToolMetadata } from '../types/tool.types';
export interface AgentCardOptions {
  /** URL where the agent accepts A2A requests */
  url: string;
  /** Provider / organization info */
  provider?: {
    organization: string;
    url?: string;
  };
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
  authentication?: {
    schemes: string[];
    credentials?: string;
  };
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
export declare function buildAgentCard(
  runtime: RuntimeLike,
  options: AgentCardOptions
): A2AAgentCard;
/**
 * Build an A2A AgentCard for a single agent (when serving one agent per endpoint).
 */
export declare function buildSingleAgentCard(
  agentMeta: AgentMetadata,
  tools: ToolMetadata[],
  options: AgentCardOptions
): A2AAgentCard;
export {};
//# sourceMappingURL=agent-card.builder.d.ts.map
