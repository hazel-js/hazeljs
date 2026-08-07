/**
 * Agent OS Platform — portable resource types (control plane, not execution).
 * API: agent.hazeljs.dev/v1alpha1
 */

import type { AgentDna } from '../dna/agent-dna';

export const PLATFORM_API_VERSION = 'agent.hazeljs.dev/v1alpha1';

export type ResourceKind = 'AgentDefinition' | 'AgentDeployment' | 'AgentRun';

export const RESOURCE_KINDS: readonly ResourceKind[] = [
  'AgentDefinition',
  'AgentDeployment',
  'AgentRun',
] as const;

export interface ObjectMeta {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  generation?: number;
  resourceVersion?: string;
  creationTimestamp?: string;
  deletionTimestamp?: string;
}

export interface ResourceRef {
  apiVersion?: string;
  kind?: ResourceKind | string;
  name: string;
  namespace?: string;
}

export type ConditionStatus = 'True' | 'False' | 'Unknown';

export type ConditionType = 'Validated' | 'Progressing' | 'Ready' | 'Degraded' | string;

export interface ResourceCondition {
  type: ConditionType;
  status: ConditionStatus;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
  observedGeneration?: number;
}

export interface ResourceStatus {
  observedGeneration?: number;
  conditions?: ResourceCondition[];
  /** Backend-specific observed facts (not agent checkpoints). */
  backend?: Record<string, unknown>;
  message?: string;
  phase?: string;
}

export interface PackageRef {
  name: string;
  /** Omit or use "latest" to resolve from project lock / registry latest. */
  version?: string;
}

export interface AgentDefinitionSpec {
  /** Nested DNA snapshot (hermetic). Mutually exclusive with packageRef. */
  dna?: AgentDna;
  /** Marketplace / registry package identity. Mutually exclusive with dna. */
  packageRef?: PackageRef;
  policyRefs?: ResourceRef[];
}

export interface AgentDefinition {
  apiVersion: string;
  kind: 'AgentDefinition';
  metadata: ObjectMeta;
  spec: AgentDefinitionSpec;
  status?: ResourceStatus;
}

export interface AgentDeploymentSpec {
  definitionRef: ResourceRef;
  /** Selects a DeploymentBackend; defaults to "local". */
  runtimeClassName?: string;
  replicas?: number;
  /** Backend-specific extensions (must not carry DNA / tool contracts). */
  backend?: Record<string, unknown>;
}

export interface AgentDeployment {
  apiVersion: string;
  kind: 'AgentDeployment';
  metadata: ObjectMeta;
  spec: AgentDeploymentSpec;
  status?: ResourceStatus;
}

export interface AgentRunSpec {
  deploymentRef?: ResourceRef;
  definitionRef?: ResourceRef;
  /** Link to existing durable AgentRun / execution id — does not store checkpoints. */
  runId?: string;
  input?: unknown;
}

/** Platform AgentRun resource (distinct from durable runtime AgentRun records). */
export interface AgentRunResource {
  apiVersion: string;
  kind: 'AgentRun';
  metadata: ObjectMeta;
  spec: AgentRunSpec;
  status?: ResourceStatus;
}

export type PlatformResource = AgentDefinition | AgentDeployment | AgentRunResource;

export interface ResolvedAgentDefinition {
  definition: AgentDefinition;
  /** Exactly one canonical DNA document after resolution. */
  dna: AgentDna;
  source: 'nested' | 'packageRef';
  packageRef?: PackageRef;
  /** Where packageRef was resolved from (when source is packageRef). */
  packageSource?: 'project' | 'registry' | 'remote' | 'custom';
  packagePath?: string;
  resolvedVersion?: string;
}

export interface ResolvedAgentDeployment {
  deployment: AgentDeployment;
  definition: ResolvedAgentDefinition;
  runtimeClassName: string;
}

export interface BackendStatus {
  ready: boolean;
  message?: string;
  unsupported?: string[];
  observed?: Record<string, unknown>;
}

export interface DeploymentBackend {
  readonly name: string;
  apply(input: ResolvedAgentDeployment): Promise<BackendStatus>;
  observe(ref: ResourceRef): Promise<BackendStatus | undefined>;
  delete(ref: ResourceRef): Promise<BackendStatus>;
}

export function resourceKey(
  kind: string,
  name: string,
  namespace = 'default'
): string {
  return `${namespace}/${kind}/${name}`;
}

export function metaNamespace(meta: ObjectMeta): string {
  return meta.namespace ?? 'default';
}

export function refKey(ref: ResourceRef, defaultKind?: string): string {
  const kind = ref.kind ?? defaultKind;
  if (!kind) throw new Error('ResourceRef missing kind');
  return resourceKey(kind, ref.name, ref.namespace ?? 'default');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function setCondition(
  status: ResourceStatus | undefined,
  condition: ResourceCondition
): ResourceStatus {
  const next: ResourceStatus = {
    ...(status ?? {}),
    conditions: [...(status?.conditions ?? [])],
  };
  const idx = next.conditions!.findIndex((c) => c.type === condition.type);
  const stamped: ResourceCondition = {
    ...condition,
    lastTransitionTime: condition.lastTransitionTime ?? nowIso(),
  };
  if (idx >= 0) {
    const prev = next.conditions![idx];
    if (prev.status === stamped.status && prev.reason === stamped.reason) {
      stamped.lastTransitionTime = prev.lastTransitionTime;
    }
    next.conditions![idx] = stamped;
  } else {
    next.conditions!.push(stamped);
  }
  return next;
}

export function conditionOf(
  status: ResourceStatus | undefined,
  type: ConditionType
): ResourceCondition | undefined {
  return status?.conditions?.find((c) => c.type === type);
}
