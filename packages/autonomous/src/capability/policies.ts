import type { AgentGatekeeperPolicy } from '@hazeljs/agent-gatekeeper';
import type { RegisteredCapability } from '../types';

/**
 * Build Gatekeeper policies from registered capabilities.
 * Default-deny remains; explicit grants become allow / require_approval rules.
 */
export function policiesFromCapabilities(
  capabilities: RegisteredCapability[]
): AgentGatekeeperPolicy[] {
  return capabilities
    .filter((c) => c.granted)
    .map((cap, index) => {
      const requireApproval = cap.approval === 'required';
      return {
        id: `aar.capability.${cap.id}`,
        version: cap.version,
        priority: 1000 - index,
        match: {
          tools: [cap.id],
        },
        rules: {
          allowWhen: requireApproval ? undefined : (): boolean => true,
          requireApprovalWhen: requireApproval ? (): boolean => true : undefined,
        },
      } satisfies AgentGatekeeperPolicy;
    });
}
