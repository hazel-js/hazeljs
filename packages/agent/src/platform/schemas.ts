/**
 * Platform resource schemas + document parser (JSON / YAML).
 */

import { parseAllDocuments } from 'yaml';
import { parseDna, type AgentDna } from '../dna/agent-dna';
import {
  PLATFORM_API_VERSION,
  RESOURCE_KINDS,
  type AgentDefinition,
  type AgentDeployment,
  type AgentRunResource,
  type PlatformResource,
  type ResourceKind,
} from './resources';

export class PlatformValidationError extends Error {
  constructor(
    message: string,
    readonly details: string[] = []
  ) {
    super(details.length ? `${message}: ${details.join('; ')}` : message);
    this.name = 'PlatformValidationError';
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function requireString(obj: Record<string, unknown>, key: string, path: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new PlatformValidationError(`Invalid ${path}`, [
      `${path}.${key} must be a non-empty string`,
    ]);
  }
  return v.trim();
}

function parseMetadata(raw: unknown, path: string): PlatformResource['metadata'] {
  if (!isRecord(raw)) {
    throw new PlatformValidationError(`Invalid ${path}.metadata`, ['metadata must be an object']);
  }
  const name = requireString(raw, 'name', `${path}.metadata`);
  const meta: PlatformResource['metadata'] = { name };
  if (raw.namespace !== undefined) {
    if (typeof raw.namespace !== 'string' || !raw.namespace.trim()) {
      throw new PlatformValidationError(`Invalid ${path}.metadata.namespace`);
    }
    meta.namespace = raw.namespace.trim();
  }
  if (raw.labels !== undefined) {
    if (!isRecord(raw.labels)) {
      throw new PlatformValidationError(`Invalid ${path}.metadata.labels`);
    }
    meta.labels = Object.fromEntries(Object.entries(raw.labels).map(([k, v]) => [k, String(v)]));
  }
  if (raw.annotations !== undefined) {
    if (!isRecord(raw.annotations)) {
      throw new PlatformValidationError(`Invalid ${path}.metadata.annotations`);
    }
    meta.annotations = Object.fromEntries(
      Object.entries(raw.annotations).map(([k, v]) => [k, String(v)])
    );
  }
  return meta;
}

function parsePackageRef(raw: unknown, path: string): { name: string; version?: string } {
  if (!isRecord(raw)) {
    throw new PlatformValidationError(`Invalid ${path}`, ['packageRef must be an object']);
  }
  const ref: { name: string; version?: string } = {
    name: requireString(raw, 'name', path),
  };
  if (raw.version !== undefined && raw.version !== null) {
    if (typeof raw.version !== 'string' || !raw.version.trim()) {
      throw new PlatformValidationError(`Invalid ${path}.version`);
    }
    ref.version = raw.version.trim();
  }
  return ref;
}

function parseResourceRef(
  raw: unknown,
  path: string
): {
  name: string;
  namespace?: string;
  kind?: string;
  apiVersion?: string;
} {
  if (!isRecord(raw)) {
    throw new PlatformValidationError(`Invalid ${path}`, ['ref must be an object with name']);
  }
  const ref: {
    name: string;
    namespace?: string;
    kind?: string;
    apiVersion?: string;
  } = {
    name: requireString(raw, 'name', path),
  };
  if (typeof raw.namespace === 'string' && raw.namespace.trim()) {
    ref.namespace = raw.namespace.trim();
  }
  if (typeof raw.kind === 'string' && raw.kind.trim()) {
    ref.kind = raw.kind.trim();
  }
  if (typeof raw.apiVersion === 'string' && raw.apiVersion.trim()) {
    ref.apiVersion = raw.apiVersion.trim();
  }
  return ref;
}

function parseAgentDefinition(doc: Record<string, unknown>): AgentDefinition {
  const path = 'AgentDefinition';
  if (!isRecord(doc.spec)) {
    throw new PlatformValidationError(`Invalid ${path}.spec`, ['spec is required']);
  }
  const specRaw = doc.spec;
  const hasDna = specRaw.dna !== undefined && specRaw.dna !== null;
  const hasPkg = specRaw.packageRef !== undefined && specRaw.packageRef !== null;
  if (hasDna && hasPkg) {
    throw new PlatformValidationError('Invalid AgentDefinition.spec', [
      'provide either spec.dna or spec.packageRef, not both (Model B: one canonical DNA)',
    ]);
  }
  if (!hasDna && !hasPkg) {
    throw new PlatformValidationError('Invalid AgentDefinition.spec', [
      'spec.dna or spec.packageRef is required',
    ]);
  }

  let dna: AgentDna | undefined;
  if (hasDna) {
    try {
      dna = parseDna(specRaw.dna as AgentDna);
    } catch (e) {
      throw new PlatformValidationError('Invalid AgentDefinition.spec.dna', [
        e instanceof Error ? e.message : String(e),
      ]);
    }
  }

  const spec: AgentDefinition['spec'] = {};
  if (dna) spec.dna = dna;
  if (hasPkg)
    spec.packageRef = parsePackageRef(specRaw.packageRef, 'AgentDefinition.spec.packageRef');
  if (specRaw.policyRefs !== undefined) {
    if (!Array.isArray(specRaw.policyRefs)) {
      throw new PlatformValidationError('Invalid AgentDefinition.spec.policyRefs');
    }
    spec.policyRefs = specRaw.policyRefs.map((r, i) =>
      parseResourceRef(r, `AgentDefinition.spec.policyRefs[${i}]`)
    );
  }

  return {
    apiVersion: requireString(doc, 'apiVersion', path),
    kind: 'AgentDefinition',
    metadata: parseMetadata(doc.metadata, path),
    spec,
  };
}

function parseAgentDeployment(doc: Record<string, unknown>): AgentDeployment {
  const path = 'AgentDeployment';
  if (!isRecord(doc.spec)) {
    throw new PlatformValidationError(`Invalid ${path}.spec`, ['spec is required']);
  }
  const definitionRef = parseResourceRef(
    doc.spec.definitionRef,
    'AgentDeployment.spec.definitionRef'
  );
  if (!definitionRef.kind) definitionRef.kind = 'AgentDefinition';

  const spec: AgentDeployment['spec'] = {
    definitionRef,
  };
  if (doc.spec.runtimeClassName !== undefined) {
    if (typeof doc.spec.runtimeClassName !== 'string' || !doc.spec.runtimeClassName.trim()) {
      throw new PlatformValidationError('Invalid AgentDeployment.spec.runtimeClassName');
    }
    spec.runtimeClassName = doc.spec.runtimeClassName.trim();
  }
  if (doc.spec.replicas !== undefined) {
    if (typeof doc.spec.replicas !== 'number' || !Number.isFinite(doc.spec.replicas)) {
      throw new PlatformValidationError('Invalid AgentDeployment.spec.replicas');
    }
    spec.replicas = doc.spec.replicas;
  }
  if (doc.spec.backend !== undefined) {
    if (!isRecord(doc.spec.backend)) {
      throw new PlatformValidationError('Invalid AgentDeployment.spec.backend');
    }
    spec.backend = { ...doc.spec.backend };
  }

  return {
    apiVersion: requireString(doc, 'apiVersion', path),
    kind: 'AgentDeployment',
    metadata: parseMetadata(doc.metadata, path),
    spec,
  };
}

function parseAgentRun(doc: Record<string, unknown>): AgentRunResource {
  const path = 'AgentRun';
  if (!isRecord(doc.spec)) {
    throw new PlatformValidationError(`Invalid ${path}.spec`, ['spec is required']);
  }
  const spec: AgentRunResource['spec'] = {};
  if (doc.spec.deploymentRef !== undefined) {
    const ref = parseResourceRef(doc.spec.deploymentRef, 'AgentRun.spec.deploymentRef');
    if (!ref.kind) ref.kind = 'AgentDeployment';
    spec.deploymentRef = ref;
  }
  if (doc.spec.definitionRef !== undefined) {
    const ref = parseResourceRef(doc.spec.definitionRef, 'AgentRun.spec.definitionRef');
    if (!ref.kind) ref.kind = 'AgentDefinition';
    spec.definitionRef = ref;
  }
  if (doc.spec.runId !== undefined) {
    if (typeof doc.spec.runId !== 'string' || !doc.spec.runId.trim()) {
      throw new PlatformValidationError('Invalid AgentRun.spec.runId');
    }
    spec.runId = doc.spec.runId.trim();
  }
  if (doc.spec.input !== undefined) {
    spec.input = doc.spec.input;
  }
  if (!spec.deploymentRef && !spec.definitionRef && !spec.runId) {
    throw new PlatformValidationError('Invalid AgentRun.spec', [
      'at least one of deploymentRef, definitionRef, or runId is required',
    ]);
  }

  return {
    apiVersion: requireString(doc, 'apiVersion', path),
    kind: 'AgentRun',
    metadata: parseMetadata(doc.metadata, path),
    spec,
  };
}

/** Validate and normalize a single resource document. */
export function parsePlatformResource(raw: unknown): PlatformResource {
  if (!isRecord(raw)) {
    throw new PlatformValidationError('Resource must be an object');
  }
  const apiVersion = requireString(raw, 'apiVersion', 'resource');
  if (apiVersion !== PLATFORM_API_VERSION) {
    throw new PlatformValidationError('Unsupported apiVersion', [
      `expected ${PLATFORM_API_VERSION}, got ${apiVersion}`,
    ]);
  }
  const kind = requireString(raw, 'kind', 'resource') as ResourceKind;
  if (!RESOURCE_KINDS.includes(kind)) {
    throw new PlatformValidationError('Unknown kind', [
      `expected one of ${RESOURCE_KINDS.join(', ')}, got ${kind}`,
    ]);
  }
  switch (kind) {
    case 'AgentDefinition':
      return parseAgentDefinition(raw);
    case 'AgentDeployment':
      return parseAgentDeployment(raw);
    case 'AgentRun':
      return parseAgentRun(raw);
    default: {
      const _exhaustive: never = kind;
      throw new PlatformValidationError(`Unhandled kind: ${String(_exhaustive)}`);
    }
  }
}

function loadRawDocuments(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // JSON object or array
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      throw new PlatformValidationError('Invalid JSON document', [
        e instanceof Error ? e.message : String(e),
      ]);
    }
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  // YAML (possibly multi-doc via ---)
  try {
    const all = parseAllDocuments(trimmed);
    const errors = all.flatMap((d) => d.errors.map((e) => e.message));
    if (errors.length) {
      throw new PlatformValidationError('Invalid YAML document', errors);
    }
    return all.map((d) => d.toJSON()).filter((v) => v !== null && v !== undefined);
  } catch (e) {
    if (e instanceof PlatformValidationError) throw e;
    throw new PlatformValidationError('Invalid YAML document', [
      e instanceof Error ? e.message : String(e),
    ]);
  }
}

/** Parse one or more resource documents from JSON or YAML text. */
export function parsePlatformDocuments(text: string): PlatformResource[] {
  const rawDocs = loadRawDocuments(text);
  if (rawDocs.length === 0) {
    throw new PlatformValidationError('No resource documents found');
  }
  return rawDocs.map((doc, i) => {
    try {
      return parsePlatformResource(doc);
    } catch (e) {
      if (e instanceof PlatformValidationError) {
        throw new PlatformValidationError(`Document[${i}] ${e.message}`, e.details);
      }
      throw e;
    }
  });
}
