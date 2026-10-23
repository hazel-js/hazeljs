/**
 * Default local Gatekeeper wiring for hazeld (HumanTask, no Redis required).
 * Soft-depends on @hazeljs/agent-gatekeeper — returns undefined when missing.
 */

import type { HumanTaskService } from '../run/human-task.service';
import type { ToolAuthorizationGate } from '../authorization/tool-authorization-gate.interface';

export interface LocalGatekeeperResult {
  authorizationGate: ToolAuthorizationGate;
  enabled: boolean;
  approvalBackend: string;
}

/**
 * Build a Gatekeeper authorization gate backed by durable HumanTaskService.
 * Returns undefined if @hazeljs/agent-gatekeeper is not installed.
 *
 * Defaults: read allowed; write/destructive/external require approval.
 */
export function tryCreateLocalGatekeeper(
  humanTasks: HumanTaskService,
  options: { enabled?: boolean; tenantId?: string } = {}
): LocalGatekeeperResult | undefined {
  if (options.enabled === false) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const gk = require('@hazeljs/agent-gatekeeper') as {
      createAgentGatekeeperBundle: (opts: Record<string, unknown>) => {
        enabled: boolean;
        authorizationGate: ToolAuthorizationGate;
        approvalBackend: string;
      };
    };

    const bundle = gk.createAgentGatekeeperBundle({
      enabled: true,
      mode: 'enforce',
      defaultDecision: 'deny',
      tenantId: options.tenantId ?? 'local',
      environment: 'local',
      humanTasks,
      audit: { testMode: process.env.NODE_ENV === 'test' },
      policies: [
        {
          id: 'local-allow-read',
          version: '1.0.0',
          priority: 100,
          match: { classifications: ['read'] },
          rules: { allowWhen: (): boolean => true },
        },
        {
          id: 'local-write-approval',
          version: '1.0.0',
          priority: 200,
          match: { classifications: ['write', 'destructive', 'external'] },
          rules: {
            allowWhen: (): boolean => true,
            requireApprovalWhen: (): boolean => true,
          },
        },
        {
          // Named tools that look like money / mutate side effects.
          id: 'local-refund-approval',
          version: '1.0.0',
          priority: 250,
          match: { tools: ['refund', 'processRefund', 'charge', 'delete*', 'drop*'] },
          rules: {
            allowWhen: (): boolean => true,
            requireApprovalWhen: (): boolean => true,
          },
        },
        {
          id: 'local-allow-named',
          version: '1.0.0',
          priority: 10,
          match: { tools: ['*'] },
          rules: { allowWhen: (): boolean => true },
        },
      ],
    });

    return {
      authorizationGate: bundle.authorizationGate,
      enabled: bundle.enabled,
      approvalBackend: bundle.approvalBackend,
    };
  } catch {
    return undefined;
  }
}
