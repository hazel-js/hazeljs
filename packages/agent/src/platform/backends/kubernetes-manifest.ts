/**
 * Map ResolvedAgentDeployment → apps/v1 Deployment (native objects, no CRD).
 */

import type { ResolvedAgentDeployment } from '../resources';
import { metaNamespace } from '../resources';
import { isKubernetesBackendExtension, type KubernetesBackendExtension } from './kubernetes-types';

export const HAZEL_K8S_LABEL_MANAGED = 'agent.hazeljs.dev/managed';
export const HAZEL_K8S_LABEL_DEFINITION = 'agent.hazeljs.dev/definition';
export const HAZEL_K8S_LABEL_DEPLOYMENT = 'agent.hazeljs.dev/deployment';
export const HAZEL_K8S_LABEL_DNA = 'agent.hazeljs.dev/dna-name';
export const HAZEL_K8S_ANNOTATION_RUNTIME = 'agent.hazeljs.dev/runtime-class';

export interface BuiltKubernetesWorkload {
  namespace: string;
  name: string;
  replicas: number;
  extension: KubernetesBackendExtension;
  manifest: Record<string, unknown>;
}

function sanitizeLabelValue(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 63) || 'x'
  );
}

export function readKubernetesExtension(
  input: ResolvedAgentDeployment
): KubernetesBackendExtension {
  const raw = input.deployment.spec.backend?.kubernetes;
  if (raw === undefined || raw === null) return {};
  if (!isKubernetesBackendExtension(raw)) {
    throw new Error('spec.backend.kubernetes must be an object');
  }
  return { ...raw };
}

/**
 * Build a portable apps/v1 Deployment for the hosting agent application.
 * Does not embed DNA prompts or tool implementations.
 */
export function buildKubernetesDeploymentManifest(
  input: ResolvedAgentDeployment,
  extension?: KubernetesBackendExtension
): BuiltKubernetesWorkload {
  const ext = extension ?? readKubernetesExtension(input);
  const name = input.deployment.metadata.name;
  const namespace = ext.namespace?.trim() || metaNamespace(input.deployment.metadata);
  const replicas = ext.replicas ?? input.deployment.spec.replicas ?? 1;
  const definitionName = input.definition.definition.metadata.name;
  const dnaName = input.definition.dna.name;
  const containerName = ext.containerName ?? 'agent';
  const image = ext.image?.trim();

  const labels: Record<string, string> = {
    app: sanitizeLabelValue(name),
    [HAZEL_K8S_LABEL_MANAGED]: 'true',
    [HAZEL_K8S_LABEL_DEFINITION]: sanitizeLabelValue(definitionName),
    [HAZEL_K8S_LABEL_DEPLOYMENT]: sanitizeLabelValue(name),
    [HAZEL_K8S_LABEL_DNA]: sanitizeLabelValue(dnaName),
    ...(ext.labels ?? {}),
  };

  const annotations: Record<string, string> = {
    [HAZEL_K8S_ANNOTATION_RUNTIME]: input.runtimeClassName,
    'agent.hazeljs.dev/definition-name': definitionName,
    'agent.hazeljs.dev/dna-name': dnaName,
    'agent.hazeljs.dev/dna-version': input.definition.dna.version ?? '',
    ...(ext.annotations ?? {}),
  };

  const container: Record<string, unknown> = {
    name: containerName,
    image: image || 'hazeljs/agent-placeholder:unset',
    imagePullPolicy: ext.imagePullPolicy ?? 'IfNotPresent',
  };
  if (ext.containerPort != null) {
    container.ports = [{ containerPort: ext.containerPort }];
  }
  if (ext.env?.length) {
    container.env = ext.env.map((e) => ({ name: e.name, value: e.value ?? '' }));
  }
  if (ext.resources) {
    container.resources = ext.resources;
  }
  if (ext.command?.length) container.command = ext.command;
  if (ext.args?.length) container.args = ext.args;

  const podSpec: Record<string, unknown> = {
    containers: [container],
  };
  if (ext.serviceAccountName) {
    podSpec.serviceAccountName = ext.serviceAccountName;
  }
  if (ext.nodeSelector && Object.keys(ext.nodeSelector).length) {
    podSpec.nodeSelector = ext.nodeSelector;
  }
  if (ext.tolerations?.length) {
    podSpec.tolerations = ext.tolerations;
  }

  const manifest: Record<string, unknown> = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name,
      namespace,
      labels,
      annotations,
    },
    spec: {
      replicas,
      selector: {
        matchLabels: {
          app: labels.app,
          [HAZEL_K8S_LABEL_DEPLOYMENT]: labels[HAZEL_K8S_LABEL_DEPLOYMENT],
        },
      },
      template: {
        metadata: {
          labels,
          annotations,
        },
        spec: podSpec,
      },
    },
  };

  return { namespace, name, replicas, extension: ext, manifest };
}
