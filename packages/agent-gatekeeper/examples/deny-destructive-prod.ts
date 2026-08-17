/**
 * Destructive infrastructure tool denied in production.
 */
import type { AgentGatekeeperPolicy } from '@hazeljs/agent-gatekeeper';

export const denyDestructiveInProduction: AgentGatekeeperPolicy = {
  id: 'prod-deny-destructive',
  version: '1.0.0',
  priority: 1000,
  match: {
    environments: ['production'],
    classifications: ['destructive'],
  },
  rules: {
    denyWhen: () => true,
  },
};
