/**
 * Map Agent DNA autonomy to PolicyEngine rules (always available, no gatekeeper import).
 */

import type { AgentAutonomy } from '../dna/agent-dna';
import type { PolicyRule } from '../policies/policy.engine';

const WRITE_HINTS = [
  'send',
  'write',
  'create',
  'update',
  'delete',
  'scale',
  'refund',
  'payment',
  'email',
  'deploy',
  'exec',
];

const SENSITIVE_HINTS = [
  'scale',
  'refund',
  'payment',
  'delete',
  'destroy',
  'kubectl',
  'k8s',
  'production',
];

export function autonomyPolicyRules(
  autonomy: AgentAutonomy | undefined,
  toolNames: string[] = []
): PolicyRule[] {
  const level = autonomy ?? 'medium';
  if (level === 'high') {
    return [];
  }

  if (level === 'low') {
    return toolNames
      .filter((name) => WRITE_HINTS.some((h) => name.toLowerCase().includes(h)))
      .map((tool) => ({
        id: `autonomy-low-${tool}`,
        tool,
        effect: 'require_approval' as const,
        reason: 'Autonomy low: external actions require approval',
        priority: 10,
      }));
  }

  return toolNames
    .filter((name) => SENSITIVE_HINTS.some((h) => name.toLowerCase().includes(h)))
    .map((tool) => ({
      id: `autonomy-medium-${tool}`,
      tool,
      effect: 'require_approval' as const,
      reason: 'Autonomy medium: sensitive actions require approval',
      priority: 20,
    }));
}
