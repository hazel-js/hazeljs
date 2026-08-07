/**
 * Admission control before desired-state upsert (Phase 3).
 * Uses PolicyEngine for optional platform.apply / platform.deploy guards.
 */

import { PolicyEngine, type PolicyDecision, type PolicyRule } from '../policies/policy.engine';
import type { AgentDefinition, AgentDeployment, PlatformResource } from './resources';
import { metaNamespace } from './resources';
import { PlatformValidationError } from './schemas';

export interface AdmissionContext {
  /** Who/what is applying (cli, ci, api). */
  actor?: string;
  /** Extra attributes for policy input (non-secret). */
  attributes?: Record<string, unknown>;
}

export interface AdmissionResult {
  allowed: boolean;
  reason?: string;
  decision?: PolicyDecision;
  warnings: string[];
}

export interface AdmissionController {
  admit(resource: PlatformResource, context?: AdmissionContext): AdmissionResult;
}

export interface PolicyAdmissionOptions {
  /** Rules evaluated against synthetic tools platform.apply / platform.deploy. */
  rules?: PolicyRule[];
  engine?: PolicyEngine;
  /** When true, missing policyRefs on definitions become warnings only (default). */
  policyRefsOptional?: boolean;
}

function baseWarnings(resource: PlatformResource): string[] {
  const warnings: string[] = [];
  if (resource.kind === 'AgentDefinition') {
    const def = resource as AgentDefinition;
    if (def.spec.policyRefs?.length) {
      warnings.push(
        `${def.spec.policyRefs.length} policyRef(s) declared — runtime PolicyEngine remains enforcement point for tools`
      );
    }
  }
  if (resource.kind === 'AgentDeployment') {
    const dep = resource as AgentDeployment;
    if (dep.spec.backend?.kubernetes != null) {
      warnings.push(
        'spec.backend.kubernetes present — local admission allows the document; local backend will mark Unsupported until a K8s backend is registered'
      );
    }
  }
  return warnings;
}

/**
 * Default admission: structural guards + optional PolicyEngine on
 * `platform.apply` (all kinds) and `platform.deploy` (deployments).
 */
export class PolicyAdmissionController implements AdmissionController {
  private readonly engine: PolicyEngine;
  private readonly policyRefsOptional: boolean;

  constructor(options: PolicyAdmissionOptions = {}) {
    this.engine = options.engine ?? new PolicyEngine(options.rules ?? []);
    this.policyRefsOptional = options.policyRefsOptional ?? true;
  }

  admit(resource: PlatformResource, context: AdmissionContext = {}): AdmissionResult {
    const warnings = baseWarnings(resource);
    const ns = metaNamespace(resource.metadata);

    if (resource.kind === 'AgentDefinition') {
      const def = resource as AgentDefinition;
      if (!this.policyRefsOptional && (def.spec.policyRefs?.length ?? 0) === 0) {
        return {
          allowed: false,
          reason: 'policyRefs required by admission policy',
          warnings,
        };
      }
    }

    const input: Record<string, unknown> = {
      kind: resource.kind,
      name: resource.metadata.name,
      namespace: ns,
      actor: context.actor ?? 'unknown',
      ...(context.attributes ?? {}),
    };

    if (resource.kind === 'AgentDeployment') {
      const dep = resource as AgentDeployment;
      input.runtimeClassName = dep.spec.runtimeClassName ?? 'local';
      input.definitionRef = dep.spec.definitionRef.name;
      input.hasKubernetesBackend = dep.spec.backend?.kubernetes != null;
    }

    const applyDecision = this.engine.evaluate('platform.apply', input);
    if (!applyDecision.allowed) {
      return {
        allowed: false,
        reason: applyDecision.reason ?? `Denied by rule ${applyDecision.ruleId ?? 'unknown'}`,
        decision: applyDecision,
        warnings,
      };
    }

    if (resource.kind === 'AgentDeployment') {
      const deployDecision = this.engine.evaluate('platform.deploy', input);
      if (!deployDecision.allowed) {
        return {
          allowed: false,
          reason: deployDecision.reason ?? `Deploy denied by rule ${deployDecision.ruleId ?? 'unknown'}`,
          decision: deployDecision,
          warnings,
        };
      }
      if (deployDecision.requiresApproval) {
        warnings.push(
          deployDecision.reason ?? 'platform.deploy requires approval (recorded as warning in OSS admission)'
        );
      }
    }

    if (applyDecision.requiresApproval) {
      warnings.push(
        applyDecision.reason ?? 'platform.apply requires approval (recorded as warning in OSS admission)'
      );
    }

    return { allowed: true, decision: applyDecision, warnings };
  }
}

/** Throw PlatformValidationError when admission denies. */
export function assertAdmitted(result: AdmissionResult, resource: PlatformResource): void {
  if (result.allowed) return;
  throw new PlatformValidationError('Admission denied', [
    `${resource.kind}/${resource.metadata.name}`,
    result.reason ?? 'denied',
  ]);
}

/** Sensible default deny for production Cloud; OSS defaults to empty allow-all engine. */
export function defaultCloudDenyDeployWithoutApproval(): PolicyRule[] {
  return [
    {
      id: 'cloud-deploy-approval',
      tool: 'platform.deploy',
      effect: 'require_approval',
      reason: 'Cloud deployments require approval',
      priority: 10,
    },
  ];
}
