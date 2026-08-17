/**
 * Email tool requiring approval for external recipients.
 */
import type { AgentGatekeeperPolicy } from '@hazeljs/agent-gatekeeper';

export const externalEmailApprovalPolicy: AgentGatekeeperPolicy = {
  id: 'email-external-approval',
  version: '1.0.0',
  priority: 120,
  match: {
    tools: ['email.send'],
  },
  rules: {
    requireApprovalWhen: ({ input }) => {
      const recipients = (input as { to?: string[] }).to ?? [];
      return recipients.some((addr) => !addr.endsWith('@example.com'));
    },
    allowWhen: () => true,
  },
};
