/**
 * Customer-support agent restricted to its current tenant.
 */
import type { AgentGatekeeperPolicy } from '@hazeljs/agent-gatekeeper';

export const tenantScopedSupportPolicy: AgentGatekeeperPolicy = {
  id: 'support-tenant-isolation',
  version: '1.0.0',
  priority: 200,
  match: {
    agents: ['support-agent'],
    tools: ['db.query', 'tickets.*'],
  },
  rules: {
    enforceTenantField: 'tenantId',
    allowWhen: ({ input, context }) =>
      (input as { tenantId?: string }).tenantId === context.tenantId,
  },
};
