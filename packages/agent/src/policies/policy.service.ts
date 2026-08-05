/**
 * PolicyService — capability gate + PolicyEngine (AOS-008).
 */

import type { AgentIdentity } from '../identity/agent-identity';
import { identityHasCapability } from '../identity/agent-identity';
import { PolicyEngine, type PolicyDecision } from './policy.engine';

export interface PolicyServiceOptions {
  policyEngine?: PolicyEngine;
  /** When true (default), missing capability on a tool with `capability` set denies. */
  enforceCapabilities?: boolean;
}

export class PolicyService {
  private identity?: AgentIdentity;
  private readonly enforceCapabilities: boolean;
  readonly policyEngine: PolicyEngine;

  constructor(options: PolicyServiceOptions = {}) {
    this.policyEngine = options.policyEngine ?? new PolicyEngine();
    this.enforceCapabilities = options.enforceCapabilities !== false;
  }

  setIdentity(identity: AgentIdentity | undefined): void {
    this.identity = identity;
  }

  getIdentity(): AgentIdentity | undefined {
    return this.identity;
  }

  /**
   * Evaluate capability then PolicyEngine rules for a tool call.
   */
  evaluateTool(
    toolName: string,
    input: Record<string, unknown>,
    toolCapability?: string
  ): PolicyDecision {
    if (this.enforceCapabilities && toolCapability) {
      if (!identityHasCapability(this.identity, toolCapability)) {
        return {
          effect: 'deny',
          ruleId: 'capability-gate',
          reason: `Agent lacks capability "${toolCapability}"`,
          input,
          allowed: false,
          requiresApproval: false,
        };
      }
    }
    return this.policyEngine.evaluate(toolName, input);
  }
}
