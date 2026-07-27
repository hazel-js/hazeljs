/**
 * Agent OS Phase 4 — Enterprise governance hooks (RBAC, residency, compliance)
 */

export type DataResidency = 'us' | 'eu' | 'apac' | 'global';

export interface GovernanceContext {
  userId?: string;
  roles?: string[];
  tenantId?: string;
  residency?: DataResidency;
  /** Compliance packs enabled e.g. ['soc2', 'gdpr', 'hipaa'] */
  compliancePacks?: string[];
  action: string;
  resource?: string;
  metadata?: Record<string, unknown>;
}

export interface GovernanceDecision {
  allowed: boolean;
  reason: string;
  audit: {
    at: string;
    action: string;
    userId?: string;
    tenantId?: string;
    residency?: DataResidency;
    compliancePacks?: string[];
  };
}

export interface GovernancePolicy {
  /** Role required for action (any match). */
  requiredRoles?: string[];
  /** Allowed residencies for this action. */
  allowedResidencies?: DataResidency[];
  /** Required compliance packs. */
  requiredPacks?: string[];
  denyReason?: string;
}

export class GovernanceGate {
  private auditLog: GovernanceDecision['audit'][] = [];

  constructor(private policies: Record<string, GovernancePolicy> = {}) {}

  setPolicy(action: string, policy: GovernancePolicy): void {
    this.policies[action] = policy;
  }

  evaluate(ctx: GovernanceContext): GovernanceDecision {
    const policy = this.policies[ctx.action] ?? this.policies['*'];
    const audit = {
      at: new Date().toISOString(),
      action: ctx.action,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      residency: ctx.residency,
      compliancePacks: ctx.compliancePacks,
    };

    if (!policy) {
      const decision: GovernanceDecision = {
        allowed: true,
        reason: 'No policy — allow by default',
        audit,
      };
      this.auditLog.push(audit);
      return decision;
    }

    if (policy.requiredRoles?.length) {
      const roles = new Set(ctx.roles ?? []);
      if (!policy.requiredRoles.some((r) => roles.has(r))) {
        const decision: GovernanceDecision = {
          allowed: false,
          reason: policy.denyReason ?? `Missing required role for ${ctx.action}`,
          audit,
        };
        this.auditLog.push(audit);
        return decision;
      }
    }

    if (policy.allowedResidencies?.length && ctx.residency) {
      if (
        !policy.allowedResidencies.includes(ctx.residency) &&
        !policy.allowedResidencies.includes('global')
      ) {
        const decision: GovernanceDecision = {
          allowed: false,
          reason: policy.denyReason ?? `Residency ${ctx.residency} not allowed`,
          audit,
        };
        this.auditLog.push(audit);
        return decision;
      }
    }

    if (policy.requiredPacks?.length) {
      const packs = new Set(ctx.compliancePacks ?? []);
      for (const p of policy.requiredPacks) {
        if (!packs.has(p)) {
          const decision: GovernanceDecision = {
            allowed: false,
            reason: policy.denyReason ?? `Missing compliance pack: ${p}`,
            audit,
          };
          this.auditLog.push(audit);
          return decision;
        }
      }
    }

    const decision: GovernanceDecision = {
      allowed: true,
      reason: 'Governance checks passed',
      audit,
    };
    this.auditLog.push(audit);
    return decision;
  }

  getAuditLog(): GovernanceDecision['audit'][] {
    return [...this.auditLog];
  }
}

/** Sensible defaults for agent.execute gating. */
export function defaultAgentGovernance(): Record<string, GovernancePolicy> {
  return {
    'agent.execute': {
      requiredRoles: ['agent:run', 'admin'],
      allowedResidencies: ['us', 'eu', 'apac', 'global'],
    },
    'agent.export_dna': {
      requiredRoles: ['agent:admin', 'admin'],
      requiredPacks: ['soc2'],
    },
  };
}
