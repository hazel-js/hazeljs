/**
 * Platform reconciler — converge AgentDeployment desired state via a backend.
 */

import type { AdmissionController } from './admission';
import { assertAdmitted } from './admission';
import type { PlatformEventSink } from './events';
import type { ResourceRepository } from './repository';
import type { PackageResolver, ResolvedPackage } from './resolve-package';
import type { DurableRunLookup } from './run-correlation';
import {
  conditionOf,
  metaNamespace,
  setCondition,
  type AgentDefinition,
  type AgentDeployment,
  type AgentRunResource,
  type DeploymentBackend,
  type PlatformResource,
  type ResolvedAgentDefinition,
  type ResolvedAgentDeployment,
  type ResourceCondition,
  type ResourceRef,
  type ResourceStatus,
} from './resources';
import { PlatformValidationError } from './schemas';

export type { PackageResolver, ResolvedPackage } from './resolve-package';

export interface PlatformReconcilerOptions {
  backends?: Record<string, DeploymentBackend>;
  /** Resolve marketplace packageRef → DNA. Required when definitions use packageRef. */
  resolvePackage?: PackageResolver;
  /** Correlate AgentRun.spec.runId with durable runtime records. */
  durableRunLookup?: DurableRunLookup;
  /** Pre-upsert admission (schema is already validated by parser). */
  admission?: AdmissionController;
  /** Control-plane event sink (audit / future billing). */
  events?: PlatformEventSink;
  /** Actor label for admission + events (cli, ci, api). */
  actor?: string;
  defaultRuntimeClass?: string;
}

export interface ReconcileResult {
  resource: PlatformResource;
  ready: boolean;
  message?: string;
}

function stamp(
  type: ResourceCondition['type'],
  status: ResourceCondition['status'],
  reason: string,
  message: string,
  observedGeneration?: number
): ResourceCondition {
  return { type, status, reason, message, observedGeneration };
}

export class PlatformReconciler {
  private readonly backends: Map<string, DeploymentBackend>;
  private readonly resolvePackage?: PackageResolver;
  private readonly durableRunLookup?: DurableRunLookup;
  private readonly admission?: AdmissionController;
  private readonly events?: PlatformEventSink;
  private readonly actor: string;
  private readonly defaultRuntimeClass: string;

  constructor(
    private readonly repo: ResourceRepository,
    options: PlatformReconcilerOptions = {}
  ) {
    this.backends = new Map(Object.entries(options.backends ?? {}));
    this.resolvePackage = options.resolvePackage;
    this.durableRunLookup = options.durableRunLookup;
    this.admission = options.admission;
    this.events = options.events;
    this.actor = options.actor ?? 'unknown';
    this.defaultRuntimeClass = options.defaultRuntimeClass ?? 'local';
  }

  private emit(partial: Parameters<NonNullable<PlatformEventSink['emit']>>[0]): void {
    this.events?.emit(partial);
  }

  registerBackend(backend: DeploymentBackend): void {
    this.backends.set(backend.name, backend);
  }

  async resolveDefinition(definition: AgentDefinition): Promise<ResolvedAgentDefinition> {
    const { dna, packageRef } = definition.spec;
    if (dna && packageRef) {
      throw new PlatformValidationError('Invalid AgentDefinition', [
        'both dna and packageRef present — resolve exactly one canonical DNA',
      ]);
    }
    if (dna) {
      return {
        definition,
        dna,
        source: 'nested',
        resolvedVersion: dna.version,
      };
    }
    if (packageRef) {
      if (!this.resolvePackage) {
        throw new PlatformValidationError('Cannot resolve packageRef', [
          `no package resolver configured for ${packageRef.name}@${packageRef.version ?? 'latest'}`,
        ]);
      }
      const resolved = await this.resolvePackage(packageRef);
      return {
        definition,
        dna: resolved.dna,
        source: 'packageRef',
        packageRef: {
          name: resolved.name,
          version: resolved.version,
        },
        packageSource: resolved.source,
        packagePath: resolved.path,
        resolvedVersion: resolved.version,
      };
    }
    throw new PlatformValidationError('Invalid AgentDefinition', [
      'spec.dna or spec.packageRef is required',
    ]);
  }

  async reconcileDeployment(name: string, namespace = 'default'): Promise<ReconcileResult> {
    const deployment = this.repo.get('AgentDeployment', name, namespace) as
      | AgentDeployment
      | undefined;
    if (!deployment) {
      throw new Error(`AgentDeployment not found: ${namespace}/AgentDeployment/${name}`);
    }

    const generation = deployment.metadata.generation ?? 1;
    let status: ResourceStatus = {
      observedGeneration: generation,
      conditions: deployment.status?.conditions,
      backend: deployment.status?.backend,
    };

    const defRef = deployment.spec.definitionRef;
    const defNs = defRef.namespace ?? namespace;
    const definition = this.repo.get('AgentDefinition', defRef.name, defNs) as
      | AgentDefinition
      | undefined;

    if (!definition) {
      status = setCondition(
        status,
        stamp(
          'Validated',
          'False',
          'DefinitionNotFound',
          `AgentDefinition "${defRef.name}" not found in namespace "${defNs}"`,
          generation
        )
      );
      status = setCondition(
        status,
        stamp('Ready', 'False', 'DefinitionNotFound', 'Waiting for AgentDefinition', generation)
      );
      status = setCondition(
        status,
        stamp('Degraded', 'True', 'DefinitionNotFound', 'Missing definition reference', generation)
      );
      const updated = this.repo.updateStatus('AgentDeployment', name, status, namespace);
      return { resource: updated, ready: false, message: status.message };
    }

    let resolvedDef: ResolvedAgentDefinition;
    try {
      resolvedDef = await this.resolveDefinition(definition);
      status = setCondition(
        status,
        stamp('Validated', 'True', 'Resolved', 'Definition and DNA resolved', generation)
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      status = setCondition(status, stamp('Validated', 'False', 'ResolveFailed', msg, generation));
      status = setCondition(status, stamp('Ready', 'False', 'ResolveFailed', msg, generation));
      status = setCondition(status, stamp('Degraded', 'True', 'ResolveFailed', msg, generation));
      const updated = this.repo.updateStatus('AgentDeployment', name, status, namespace);
      return { resource: updated, ready: false, message: msg };
    }

    const runtimeClassName = deployment.spec.runtimeClassName?.trim() || this.defaultRuntimeClass;
    const backend = this.backends.get(runtimeClassName);
    if (!backend) {
      const msg = `No DeploymentBackend registered for runtimeClassName "${runtimeClassName}"`;
      status = setCondition(
        status,
        stamp('Progressing', 'False', 'BackendMissing', msg, generation)
      );
      status = setCondition(status, stamp('Ready', 'False', 'BackendMissing', msg, generation));
      status = setCondition(status, stamp('Degraded', 'True', 'BackendMissing', msg, generation));
      const updated = this.repo.updateStatus('AgentDeployment', name, status, namespace);
      return { resource: updated, ready: false, message: msg };
    }

    status = setCondition(
      status,
      stamp('Progressing', 'True', 'Applying', `Applying via backend "${backend.name}"`, generation)
    );
    this.repo.updateStatus('AgentDeployment', name, status, namespace);

    const resolved: ResolvedAgentDeployment = {
      deployment,
      definition: resolvedDef,
      runtimeClassName,
    };

    const backendStatus = await backend.apply(resolved);
    status = {
      ...status,
      observedGeneration: generation,
      backend: backendStatus.observed,
      message: backendStatus.message,
    };

    if (backendStatus.ready) {
      status = setCondition(
        status,
        stamp('Progressing', 'False', 'Applied', backendStatus.message ?? 'Applied', generation)
      );
      status = setCondition(
        status,
        stamp('Ready', 'True', 'Ready', backendStatus.message ?? 'Ready', generation)
      );
      status = setCondition(
        status,
        stamp('Degraded', 'False', 'Ready', 'Backend reported ready', generation)
      );
    } else {
      const reason = backendStatus.unsupported?.length ? 'Unsupported' : 'BackendNotReady';
      status = setCondition(
        status,
        stamp('Progressing', 'False', reason, backendStatus.message ?? reason, generation)
      );
      status = setCondition(
        status,
        stamp('Ready', 'False', reason, backendStatus.message ?? reason, generation)
      );
      status = setCondition(
        status,
        stamp('Degraded', 'True', reason, backendStatus.message ?? reason, generation)
      );
    }

    const updated = this.repo.updateStatus('AgentDeployment', name, status, namespace);
    return {
      resource: updated,
      ready: backendStatus.ready,
      message: backendStatus.message,
    };
  }

  /** Reconcile AgentRun: validate refs; correlate durable run; do not copy checkpoints. */
  async reconcileRun(name: string, namespace = 'default'): Promise<ReconcileResult> {
    const run = this.repo.get('AgentRun', name, namespace) as AgentRunResource | undefined;
    if (!run) {
      throw new Error(`AgentRun not found: ${namespace}/AgentRun/${name}`);
    }
    const generation = run.metadata.generation ?? 1;
    let status: ResourceStatus = { observedGeneration: generation, conditions: [] };
    const errors: string[] = [];

    if (run.spec.definitionRef) {
      const ns = run.spec.definitionRef.namespace ?? namespace;
      if (!this.repo.get('AgentDefinition', run.spec.definitionRef.name, ns)) {
        errors.push(`AgentDefinition "${run.spec.definitionRef.name}" not found`);
      }
    }
    if (run.spec.deploymentRef) {
      const ns = run.spec.deploymentRef.namespace ?? namespace;
      if (!this.repo.get('AgentDeployment', run.spec.deploymentRef.name, ns)) {
        errors.push(`AgentDeployment "${run.spec.deploymentRef.name}" not found`);
      }
    }

    if (errors.length) {
      status = setCondition(
        status,
        stamp('Ready', 'False', 'RefNotFound', errors.join('; '), generation)
      );
      status = setCondition(
        status,
        stamp('Degraded', 'True', 'RefNotFound', errors.join('; '), generation)
      );
      const updated = this.repo.updateStatus('AgentRun', name, status, namespace);
      return { resource: updated, ready: false, message: errors.join('; ') };
    }

    if (run.spec.runId && this.durableRunLookup) {
      const summary = await this.durableRunLookup.lookup(run.spec.runId);
      status.backend = { ...summary };
      if (!summary.found) {
        status = setCondition(
          status,
          stamp(
            'Ready',
            'False',
            'DurableRunNotFound',
            `No durable run for runId ${run.spec.runId}`,
            generation
          )
        );
        status = setCondition(
          status,
          stamp(
            'Degraded',
            'True',
            'DurableRunNotFound',
            summary.note ?? 'Durable run missing',
            generation
          )
        );
        const updated = this.repo.updateStatus('AgentRun', name, status, namespace);
        return {
          resource: updated,
          ready: false,
          message: `Durable run not found: ${run.spec.runId}`,
        };
      }
      status = setCondition(
        status,
        stamp(
          'Ready',
          'True',
          'Correlated',
          `Correlated with durable run ${summary.runId} (${summary.status})`,
          generation
        )
      );
      status = setCondition(
        status,
        stamp('Degraded', 'False', 'Correlated', 'Durable run found', generation)
      );
      const updated = this.repo.updateStatus('AgentRun', name, status, namespace);
      return { resource: updated, ready: true, message: conditionOf(status, 'Ready')?.message };
    }

    status = setCondition(
      status,
      stamp(
        'Ready',
        'True',
        'Linked',
        run.spec.runId
          ? `Linked to runId ${run.spec.runId} (no durable lookup configured)`
          : 'AgentRun resource recorded (no durable runId yet)',
        generation
      )
    );
    status = setCondition(
      status,
      stamp('Degraded', 'False', 'Linked', 'References valid', generation)
    );
    status.backend = {
      runId: run.spec.runId,
      note: 'Checkpoints remain in the durable AgentRun store, not this resource',
    };
    const updated = this.repo.updateStatus('AgentRun', name, status, namespace);
    return { resource: updated, ready: true, message: conditionOf(status, 'Ready')?.message };
  }

  async applyResource(resource: PlatformResource): Promise<ReconcileResult> {
    if (this.admission) {
      const admission = this.admission.admit(resource, { actor: this.actor });
      if (!admission.allowed) {
        this.emit({
          type: 'AdmissionDenied',
          kind: resource.kind,
          name: resource.metadata.name,
          namespace: metaNamespace(resource.metadata),
          reason: admission.reason,
          message: admission.reason,
          attributes: { actor: this.actor },
        });
        assertAdmitted(admission, resource);
      }
      this.emit({
        type: 'AdmissionAllowed',
        kind: resource.kind,
        name: resource.metadata.name,
        namespace: metaNamespace(resource.metadata),
        attributes: {
          actor: this.actor,
          warnings: admission.warnings.length,
        },
      });
    }

    const stored = this.repo.upsert(resource);
    this.emit({
      type: 'ResourceApplied',
      kind: stored.kind,
      name: stored.metadata.name,
      namespace: metaNamespace(stored.metadata),
      generation: stored.metadata.generation,
      attributes: { actor: this.actor },
    });

    let result: ReconcileResult;
    if (stored.kind === 'AgentDefinition') {
      const generation = stored.metadata.generation ?? 1;
      let status: ResourceStatus = { observedGeneration: generation };
      try {
        const resolved = await this.resolveDefinition(stored as AgentDefinition);
        status = setCondition(
          status,
          stamp('Validated', 'True', 'Resolved', 'DNA resolved', generation)
        );
        status = setCondition(
          status,
          stamp('Ready', 'True', 'Ready', 'Definition ready', generation)
        );
        status.backend = {
          dnaName: resolved.dna.name,
          dnaVersion: resolved.dna.version,
          source: resolved.source,
          packageSource: resolved.packageSource,
          packageRef: resolved.packageRef,
          packagePath: resolved.packagePath,
          toolCount: resolved.dna.tools?.length ?? 0,
        };
        if (resolved.source === 'packageRef') {
          this.emit({
            type: 'PackageResolved',
            kind: stored.kind,
            name: stored.metadata.name,
            namespace: metaNamespace(stored.metadata),
            attributes: {
              packageSource: resolved.packageSource ?? 'custom',
              packageName: resolved.packageRef?.name ?? '',
              version: resolved.resolvedVersion ?? '',
            },
          });
        }
        const updated = this.repo.updateStatus(
          'AgentDefinition',
          stored.metadata.name,
          status,
          metaNamespace(stored.metadata)
        );
        result = { resource: updated, ready: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        status = setCondition(
          status,
          stamp('Validated', 'False', 'ResolveFailed', msg, generation)
        );
        status = setCondition(status, stamp('Ready', 'False', 'ResolveFailed', msg, generation));
        const updated = this.repo.updateStatus(
          'AgentDefinition',
          stored.metadata.name,
          status,
          metaNamespace(stored.metadata)
        );
        result = { resource: updated, ready: false, message: msg };
      }
    } else if (stored.kind === 'AgentDeployment') {
      result = await this.reconcileDeployment(stored.metadata.name, metaNamespace(stored.metadata));
    } else {
      result = await this.reconcileRun(stored.metadata.name, metaNamespace(stored.metadata));
    }

    this.emit({
      type: 'ResourceReconciled',
      kind: result.resource.kind,
      name: result.resource.metadata.name,
      namespace: metaNamespace(result.resource.metadata),
      generation: result.resource.metadata.generation,
      ready: result.ready,
      message: result.message,
      reason: conditionOf(result.resource.status, 'Ready')?.reason,
    });

    if (
      result.resource.kind === 'AgentDeployment' &&
      conditionOf(result.resource.status, 'Ready')?.reason === 'Unsupported'
    ) {
      this.emit({
        type: 'BackendUnsupported',
        kind: result.resource.kind,
        name: result.resource.metadata.name,
        namespace: metaNamespace(result.resource.metadata),
        message: result.message,
      });
    }

    if (
      result.resource.kind === 'AgentRun' &&
      conditionOf(result.resource.status, 'Ready')?.reason === 'Correlated'
    ) {
      this.emit({
        type: 'DurableRunCorrelated',
        kind: 'AgentRun',
        name: result.resource.metadata.name,
        namespace: metaNamespace(result.resource.metadata),
        attributes: {
          runId: String(result.resource.status?.backend?.runId ?? ''),
          status: String(result.resource.status?.backend?.status ?? ''),
        },
      });
    }

    return result;
  }

  async deleteResource(ref: ResourceRef & { kind: string }): Promise<{
    deleted: boolean;
    backendMessage?: string;
  }> {
    const ns = ref.namespace ?? 'default';
    if (ref.kind === 'AgentDeployment') {
      const runtimeClass =
        (
          this.repo.get('AgentDeployment', ref.name, ns) as AgentDeployment | undefined
        )?.spec.runtimeClassName?.trim() || this.defaultRuntimeClass;
      const backend = this.backends.get(runtimeClass);
      let backendMessage: string | undefined;
      if (backend) {
        const result = await backend.delete({ name: ref.name, namespace: ns, kind: ref.kind });
        backendMessage = result.message;
      }
      const deleted = this.repo.delete(ref.kind, ref.name, ns);
      this.emit({
        type: 'ResourceDeleted',
        kind: ref.kind,
        name: ref.name,
        namespace: ns,
        ready: deleted,
        message: backendMessage,
        attributes: { actor: this.actor },
      });
      return { deleted, backendMessage };
    }
    const deleted = this.repo.delete(ref.kind, ref.name, ns);
    this.emit({
      type: 'ResourceDeleted',
      kind: ref.kind,
      name: ref.name,
      namespace: ns,
      ready: deleted,
      attributes: { actor: this.actor },
    });
    return { deleted };
  }

  /**
   * Reconcile all Deployments and/or Runs in the repository (local control-plane loop).
   * Definitions are not reconciled — they are resolved when deployments apply.
   */
  async reconcileAll(options: ReconcileAllOptions = {}): Promise<ReconcileAllResult> {
    const kinds = options.kinds ?? (['AgentDeployment', 'AgentRun'] as const);
    const results: ReconcileResult[] = [];
    const errors: ReconcileAllResult['errors'] = [];

    for (const kind of kinds) {
      if (kind === 'AgentDefinition') continue;
      const items = this.repo.list({
        kind,
        namespace: options.namespace,
      });
      for (const item of items) {
        const name = item.metadata.name;
        const namespace = metaNamespace(item.metadata);
        try {
          const result =
            kind === 'AgentDeployment'
              ? await this.reconcileDeployment(name, namespace)
              : await this.reconcileRun(name, namespace);
          results.push(result);
          this.emit({
            type: 'ResourceReconciled',
            kind,
            name,
            namespace,
            ready: result.ready,
            message: result.message,
            attributes: { actor: this.actor, trigger: 'reconcileAll' },
          });
        } catch (e) {
          errors.push({
            kind,
            name,
            namespace,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    return {
      results,
      ready: results.filter((r) => r.ready).length,
      notReady: results.filter((r) => !r.ready).length,
      errors,
    };
  }
}

export interface ReconcileAllOptions {
  /** Defaults to AgentDeployment + AgentRun. */
  kinds?: Array<'AgentDeployment' | 'AgentRun' | 'AgentDefinition'>;
  /** Limit to one namespace (omit = all namespaces). */
  namespace?: string;
}

export interface ReconcileAllResult {
  results: ReconcileResult[];
  ready: number;
  notReady: number;
  errors: Array<{ kind: string; name: string; namespace: string; error: string }>;
}
