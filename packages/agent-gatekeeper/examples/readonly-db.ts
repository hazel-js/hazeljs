/**
 * Database tool limited to read-only operations.
 */
import type { AgentGatekeeperPolicy } from '@hazeljs/agent-gatekeeper';

export const readOnlyDatabasePolicy: AgentGatekeeperPolicy = {
  id: 'db-read-only',
  version: '1.0.0',
  priority: 150,
  match: {
    tools: ['db.query', 'db.*'],
  },
  rules: {
    denyWhen: ({ input, classification }) =>
      classification === 'write' ||
      classification === 'destructive' ||
      /\b(insert|update|delete|drop|alter)\b/i.test(String((input as { sql?: string }).sql ?? '')),
    allowWhen: ({ classification }) => classification === 'read',
  },
};
