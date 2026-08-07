/**
 * Kubernetes backend extension types (spec.backend.kubernetes).
 * Kept out of core DNA / portable schema — adapter-only.
 */

export interface KubernetesResourceRequirements {
  requests?: Record<string, string>;
  limits?: Record<string, string>;
}

export interface KubernetesEnvVar {
  name: string;
  value?: string;
}

/**
 * AgentDeployment.spec.backend.kubernetes
 * Pod affinity / exotic volume syntax stay here — never in core resource schema.
 */
export interface KubernetesBackendExtension {
  /** Target namespace (default: AgentDeployment metadata.namespace or "default"). */
  namespace?: string;
  /** Container image for the hosting application (required for non-dryRun apply). */
  image?: string;
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never' | string;
  containerName?: string;
  containerPort?: number;
  /** Overrides AgentDeployment.spec.replicas when set. */
  replicas?: number;
  serviceAccountName?: string;
  nodeSelector?: Record<string, string>;
  tolerations?: unknown[];
  resources?: KubernetesResourceRequirements;
  env?: KubernetesEnvVar[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  /** Plan manifest only — do not call the cluster API. */
  dryRun?: boolean;
  /** Extra command/args for the container. */
  command?: string[];
  args?: string[];
}

export interface KubernetesWorkloadObservation {
  name: string;
  namespace: string;
  uid?: string;
  replicas?: number;
  readyReplicas?: number;
  availableReplicas?: number;
  updatedReplicas?: number;
  generation?: number;
  observedGeneration?: number;
  conditions?: Array<{ type: string; status: string; reason?: string; message?: string }>;
  images?: string[];
  /** Raw existence — false when 404. */
  exists: boolean;
}

/**
 * Minimal cluster seam used by KubernetesDeploymentBackend.
 * Implement with @hazeljs/kubernetes RestClient.request or any apps/v1 client.
 */
export interface KubernetesWorkloadClient {
  applyDeployment(manifest: Record<string, unknown>): Promise<KubernetesWorkloadObservation>;
  getDeployment(
    namespace: string,
    name: string
  ): Promise<KubernetesWorkloadObservation | undefined>;
  deleteDeployment(namespace: string, name: string): Promise<{ deleted: boolean }>;
}

export function isKubernetesBackendExtension(value: unknown): value is KubernetesBackendExtension {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
