/**
 * Platform observability helpers — describe summaries without secrets.
 */

import {
  conditionOf,
  metaNamespace,
  type PlatformResource,
  type ResourceCondition,
} from './resources';

export interface ResourceSummary {
  kind: string;
  name: string;
  namespace: string;
  generation?: number;
  observedGeneration?: number;
  ready?: string;
  degraded?: string;
  validated?: string;
  progressing?: string;
  phase?: string;
  message?: string;
  reason?: string;
  /** Safe correlation fields from status.backend */
  correlation?: Record<string, unknown>;
  conditions?: ResourceCondition[];
}

function pickCorrelation(backend: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!backend) return undefined;
  const allow = [
    'dnaName',
    'dnaVersion',
    'source',
    'packageSource',
    'packageRef',
    'packagePath',
    'toolCount',
    'runtimeClassName',
    'definition',
    'dnaSource',
    'runId',
    'found',
    'status',
    'attempt',
    'checkpointId',
    'timelineSteps',
    'store',
    'note',
  ];
  const out: Record<string, unknown> = {};
  for (const key of allow) {
    if (backend[key] !== undefined) out[key] = backend[key];
  }
  return Object.keys(out).length ? out : undefined;
}

/** Compact, secret-safe summary for CLI get/describe and Cloud meters later. */
export function summarizeResource(resource: PlatformResource): ResourceSummary {
  const status = resource.status;
  const ready = conditionOf(status, 'Ready');
  const degraded = conditionOf(status, 'Degraded');
  const validated = conditionOf(status, 'Validated');
  const progressing = conditionOf(status, 'Progressing');

  return {
    kind: resource.kind,
    name: resource.metadata.name,
    namespace: metaNamespace(resource.metadata),
    generation: resource.metadata.generation,
    observedGeneration: status?.observedGeneration,
    ready: ready?.status,
    degraded: degraded?.status,
    validated: validated?.status,
    progressing: progressing?.status,
    phase: status?.phase,
    message: status?.message ?? ready?.message,
    reason: ready?.reason,
    correlation: pickCorrelation(status?.backend),
    conditions: status?.conditions,
  };
}

export function isReady(resource: PlatformResource): boolean {
  return conditionOf(resource.status, 'Ready')?.status === 'True';
}

export function isGenerationCurrent(resource: PlatformResource): boolean {
  const gen = resource.metadata.generation ?? 1;
  const observed = resource.status?.observedGeneration;
  return observed === undefined || observed === gen;
}
