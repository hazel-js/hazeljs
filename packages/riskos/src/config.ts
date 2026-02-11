/**
 * RiskOS configuration
 */

import type { EventBus } from './bus/eventBus';
import type { AuditSink } from './audit/sink';
import type { PolicyEngine } from './compliance/policyEngine';

/** RiskOS plugin configuration */
export interface RiskOSConfig {
  /** Event bus for cross-module communication (optional; uses noop if not provided) */
  bus?: EventBus;
  /** Audit sink for compliance traces (optional) */
  auditSink?: AuditSink;
  /** Policy engine for compliance enforcement (optional) */
  policyEngine?: PolicyEngine;
  /** Enable policy enforcement (default: true when policyEngine provided) */
  enforcePolicies?: boolean;
  /** App version for trace metadata */
  appVersion?: string;
  /** Config hash for trace integrity */
  configHash?: string;
  /** Policy version for trace integrity */
  policyVersion?: string;
}
