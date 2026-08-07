/**
 * Kubernetes DeploymentBackend spike — native apps/v1 Deployments, no CRDs.
 * Optional: inject KubernetesWorkloadClient (in-memory, request-based, or live).
 */

import type {
  BackendStatus,
  DeploymentBackend,
  ResolvedAgentDeployment,
  ResourceRef,
} from '../resources';
import { metaNamespace, resourceKey } from '../resources';
import { buildKubernetesDeploymentManifest, readKubernetesExtension } from './kubernetes-manifest';
import type { KubernetesWorkloadClient, KubernetesWorkloadObservation } from './kubernetes-types';

export interface KubernetesDeploymentBackendOptions {
  /** Cluster client. Required unless every apply uses dryRun. */
  client?: KubernetesWorkloadClient;
  /** Backend name registered with the reconciler (default: kubernetes). */
  name?: string;
  /** When true, never call the cluster — return planned manifest only. */
  forceDryRun?: boolean;
}

function deploymentRefKey(ref: ResourceRef): string {
  return resourceKey('AgentDeployment', ref.name, ref.namespace ?? 'default');
}

function isReadyObservation(obs: KubernetesWorkloadObservation, desiredReplicas: number): boolean {
  if (!obs.exists) return false;
  const ready = obs.readyReplicas ?? 0;
  return ready >= desiredReplicas;
}

function toBackendStatus(
  obs: KubernetesWorkloadObservation,
  desiredReplicas: number,
  extra?: Record<string, unknown>
): BackendStatus {
  const ready = isReadyObservation(obs, desiredReplicas);
  return {
    ready,
    message: ready
      ? `Kubernetes Deployment ${obs.namespace}/${obs.name} ready (${obs.readyReplicas ?? 0}/${desiredReplicas})`
      : `Kubernetes Deployment ${obs.namespace}/${obs.name} not ready (${obs.readyReplicas ?? 0}/${desiredReplicas})`,
    observed: {
      api: 'apps/v1',
      kind: 'Deployment',
      name: obs.name,
      namespace: obs.namespace,
      uid: obs.uid,
      replicas: obs.replicas,
      readyReplicas: obs.readyReplicas,
      availableReplicas: obs.availableReplicas,
      generation: obs.generation,
      observedGeneration: obs.observedGeneration,
      conditions: obs.conditions,
      images: obs.images,
      ...extra,
    },
  };
}

/**
 * Maps AgentDeployment → native Kubernetes Deployment.
 * Platform repository remains source of truth; this adapter only materializes workloads.
 */
export class KubernetesDeploymentBackend implements DeploymentBackend {
  readonly name: string;
  private readonly client?: KubernetesWorkloadClient;
  private readonly forceDryRun: boolean;
  private readonly lastManifest = new Map<string, Record<string, unknown>>();

  constructor(options: KubernetesDeploymentBackendOptions = {}) {
    this.name = options.name ?? 'kubernetes';
    this.client = options.client;
    this.forceDryRun = options.forceDryRun ?? false;
  }

  async apply(input: ResolvedAgentDeployment): Promise<BackendStatus> {
    const ext = readKubernetesExtension(input);
    const built = buildKubernetesDeploymentManifest(input, ext);
    const key = deploymentRefKey({
      name: input.deployment.metadata.name,
      namespace: metaNamespace(input.deployment.metadata),
    });
    this.lastManifest.set(key, built.manifest);

    const dryRun = this.forceDryRun || ext.dryRun === true;
    if (dryRun) {
      return {
        ready: true,
        message: 'Kubernetes dry-run: Deployment manifest planned (no cluster call)',
        observed: {
          api: 'apps/v1',
          kind: 'Deployment',
          dryRun: true,
          name: built.name,
          namespace: built.namespace,
          replicas: built.replicas,
          image: ext.image,
          definition: input.definition.definition.metadata.name,
          dnaName: input.definition.dna.name,
          manifest: built.manifest,
        },
      };
    }

    if (!ext.image?.trim()) {
      return {
        ready: false,
        message: 'Kubernetes backend requires spec.backend.kubernetes.image (or dryRun: true)',
        unsupported: ['missing image'],
        observed: {
          name: built.name,
          namespace: built.namespace,
          definition: input.definition.definition.metadata.name,
        },
      };
    }

    if (!this.client) {
      return {
        ready: false,
        message: 'KubernetesWorkloadClient not configured — inject a client or set dryRun: true',
        unsupported: ['no kubernetes client'],
        observed: {
          name: built.name,
          namespace: built.namespace,
          plannedManifest: built.manifest,
        },
      };
    }

    const obs = await this.client.applyDeployment(built.manifest);
    return toBackendStatus(obs, built.replicas, {
      definition: input.definition.definition.metadata.name,
      dnaName: input.definition.dna.name,
      runtimeClassName: input.runtimeClassName,
    });
  }

  async observe(ref: ResourceRef): Promise<BackendStatus | undefined> {
    if (!this.client) return undefined;
    const namespace = ref.namespace ?? 'default';
    const obs = await this.client.getDeployment(namespace, ref.name);
    if (!obs) return undefined;
    return toBackendStatus(obs, obs.replicas ?? 1);
  }

  async delete(ref: ResourceRef): Promise<BackendStatus> {
    const namespace = ref.namespace ?? 'default';
    const key = deploymentRefKey(ref);
    this.lastManifest.delete(key);

    if (this.forceDryRun) {
      return {
        ready: true,
        message: 'Kubernetes dry-run: delete skipped',
        observed: { deleted: true, dryRun: true, name: ref.name, namespace },
      };
    }

    if (!this.client) {
      return {
        ready: true,
        message: 'No Kubernetes client — nothing deleted in cluster',
        observed: { deleted: false, name: ref.name, namespace },
      };
    }

    const result = await this.client.deleteDeployment(namespace, ref.name);
    return {
      ready: true,
      message: result.deleted
        ? `Kubernetes Deployment ${namespace}/${ref.name} deleted`
        : `Kubernetes Deployment ${namespace}/${ref.name} already absent`,
      observed: { deleted: result.deleted, name: ref.name, namespace },
    };
  }

  /** Last planned/applied manifest for debugging. */
  getLastManifest(ref: ResourceRef): Record<string, unknown> | undefined {
    return this.lastManifest.get(deploymentRefKey(ref));
  }
}
