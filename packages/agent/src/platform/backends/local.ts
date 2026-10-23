/**
 * DeploymentBackend contract + local adapter.
 */

import type {
  BackendStatus,
  DeploymentBackend,
  ResolvedAgentDeployment,
  ResourceRef,
} from '../resources';
import { metaNamespace, resourceKey } from '../resources';

export type { DeploymentBackend };

function deploymentRefKey(ref: ResourceRef): string {
  return resourceKey('AgentDeployment', ref.name, ref.namespace ?? 'default');
}

export type HostedApplyHandler = (input: ResolvedAgentDeployment) => void | Promise<void>;

/**
 * Honest local backend: records resolved deployments in-process.
 * Reports unsupported Kubernetes / placement features instead of pretending success.
 *
 * When hosted inside hazeld (`setHosted`), `ready` means the AgentOS runtime
 * registered the DNA — not merely that status was recorded.
 */
export class LocalDeploymentBackend implements DeploymentBackend {
  readonly name = 'local';
  private readonly records = new Map<string, BackendStatus>();
  private hosted = false;
  private onHostedApply?: HostedApplyHandler;

  /**
   * Mark this backend as running inside a long-lived Agent OS node (hazeld).
   * Optional `onApply` registers DNA into AgentOS when reconcile applies a deployment.
   */
  setHosted(options: boolean | { onApply?: HostedApplyHandler } = true): void {
    if (typeof options === 'boolean') {
      this.hosted = options;
      return;
    }
    this.hosted = true;
    this.onHostedApply = options.onApply;
  }

  isHosted(): boolean {
    return this.hosted;
  }

  async apply(input: ResolvedAgentDeployment): Promise<BackendStatus> {
    const unsupported: string[] = [];
    const backendExt = input.deployment.spec.backend;
    if (backendExt?.kubernetes != null) {
      unsupported.push('spec.backend.kubernetes (use a Kubernetes DeploymentBackend)');
    }
    if (input.deployment.spec.replicas != null && input.deployment.spec.replicas > 1) {
      unsupported.push('replicas > 1 (local backend is single-process)');
    }

    if (unsupported.length) {
      const status: BackendStatus = {
        ready: false,
        message: `Local backend does not support: ${unsupported.join('; ')}`,
        unsupported,
        observed: {
          runtimeClassName: input.runtimeClassName,
          definition: input.definition.definition.metadata.name,
          dnaName: input.definition.dna.name,
        },
      };
      this.records.set(
        deploymentRefKey({
          name: input.deployment.metadata.name,
          namespace: metaNamespace(input.deployment.metadata),
        }),
        status
      );
      return status;
    }

    if (this.hosted && this.onHostedApply) {
      await this.onHostedApply(input);
    }

    const status: BackendStatus = {
      ready: true,
      message: this.hosted ? 'Agent registered in AgentOS (hazeld)' : 'Local deployment recorded',
      observed: {
        runtimeClassName: input.runtimeClassName,
        definition: input.definition.definition.metadata.name,
        dnaName: input.definition.dna.name,
        dnaSource: input.definition.source,
        packageRef: input.definition.packageRef,
        hosted: this.hosted,
        recordedAt: new Date().toISOString(),
      },
    };
    this.records.set(
      deploymentRefKey({
        name: input.deployment.metadata.name,
        namespace: metaNamespace(input.deployment.metadata),
      }),
      status
    );
    return status;
  }

  async observe(ref: ResourceRef): Promise<BackendStatus | undefined> {
    return this.records.get(deploymentRefKey(ref));
  }

  async delete(ref: ResourceRef): Promise<BackendStatus> {
    const key = deploymentRefKey(ref);
    const existed = this.records.delete(key);
    return {
      ready: true,
      message: existed ? 'Local deployment removed' : 'Local deployment already absent',
      observed: { deleted: existed },
    };
  }

  /** Test helper */
  clear(): void {
    this.records.clear();
  }

  /** Seed observed state after repository hydrate (CLI restart). */
  seed(ref: ResourceRef, status: BackendStatus): void {
    this.records.set(deploymentRefKey(ref), status);
  }
}
