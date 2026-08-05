/**
 * Agent identity distinct from user JWT (ADR-007 / AOS-008).
 */

export interface AgentIdentity {
  agentName: string;
  version?: string;
  tenantId?: string;
  /** Capability grants, e.g. `payments.write`, `memory.read`. `*` grants all. */
  capabilities: string[];
}

export function identityFromAgentConfig(config: {
  name: string;
  version?: string;
  tenantId?: string;
  capabilities?: string[];
}): AgentIdentity {
  return {
    agentName: config.name,
    version: config.version,
    tenantId: config.tenantId,
    capabilities: config.capabilities ?? [],
  };
}

/** True when identity may use the given capability (empty capabilities = unrestricted for back-compat). */
export function identityHasCapability(
  identity: AgentIdentity | undefined,
  capability: string | undefined
): boolean {
  if (!capability) return true;
  if (!identity) return true;
  if (!identity.capabilities.length) return true;
  if (identity.capabilities.includes('*')) return true;
  return identity.capabilities.includes(capability);
}
