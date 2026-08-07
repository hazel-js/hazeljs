/**
 * Resource repository — desired-state store for the platform control plane.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  metaNamespace,
  nowIso,
  resourceKey,
  type PlatformResource,
  type ResourceKind,
  type ResourceRef,
  type ResourceStatus,
} from './resources';

export interface ResourceRepository {
  get(kind: ResourceKind | string, name: string, namespace?: string): PlatformResource | undefined;
  list(filter?: { kind?: ResourceKind | string; namespace?: string }): PlatformResource[];
  /**
   * Upsert desired state. Increments generation only when spec meaningfully changes.
   * Status from the incoming document is ignored (status is written via updateStatus).
   */
  upsert(resource: PlatformResource): PlatformResource;
  updateStatus(
    kind: ResourceKind | string,
    name: string,
    status: ResourceStatus,
    namespace?: string
  ): PlatformResource;
  delete(kind: ResourceKind | string, name: string, namespace?: string): boolean;
}

function stableSpecJson(resource: PlatformResource): string {
  return JSON.stringify(resource.spec);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export class InMemoryResourceRepository implements ResourceRepository {
  private readonly store = new Map<string, PlatformResource>();

  get(kind: string, name: string, namespace = 'default'): PlatformResource | undefined {
    const found = this.store.get(resourceKey(kind, name, namespace));
    return found ? clone(found) : undefined;
  }

  list(filter?: { kind?: string; namespace?: string }): PlatformResource[] {
    const out: PlatformResource[] = [];
    for (const resource of this.store.values()) {
      if (filter?.kind && resource.kind !== filter.kind) continue;
      if (
        filter?.namespace !== undefined &&
        metaNamespace(resource.metadata) !== filter.namespace
      ) {
        continue;
      }
      out.push(clone(resource));
    }
    return out.sort((a, b) =>
      resourceKey(a.kind, a.metadata.name, metaNamespace(a.metadata)).localeCompare(
        resourceKey(b.kind, b.metadata.name, metaNamespace(b.metadata))
      )
    );
  }

  upsert(resource: PlatformResource): PlatformResource {
    const ns = metaNamespace(resource.metadata);
    const key = resourceKey(resource.kind, resource.metadata.name, ns);
    const existing = this.store.get(key);
    const now = nowIso();

    if (!existing) {
      const created = clone(resource);
      created.metadata = {
        ...created.metadata,
        namespace: ns,
        generation: 1,
        resourceVersion: '1',
        creationTimestamp: now,
      };
      delete created.status;
      this.store.set(key, created);
      return clone(created);
    }

    const next = clone(existing);
    const specChanged = stableSpecJson(existing) !== stableSpecJson(resource);
    next.spec = clone(resource.spec) as PlatformResource['spec'];
    next.metadata = {
      ...next.metadata,
      labels: resource.metadata.labels,
      annotations: resource.metadata.annotations,
      name: resource.metadata.name,
      namespace: ns,
    };
    if (specChanged) {
      next.metadata.generation = (existing.metadata.generation ?? 1) + 1;
      next.metadata.resourceVersion = String(Number(existing.metadata.resourceVersion ?? '1') + 1);
    }
    // Keep existing status until reconciler updates it.
    this.store.set(key, next);
    return clone(next);
  }

  updateStatus(
    kind: string,
    name: string,
    status: ResourceStatus,
    namespace = 'default'
  ): PlatformResource {
    const key = resourceKey(kind, name, namespace);
    const existing = this.store.get(key);
    if (!existing) {
      throw new Error(`Resource not found: ${key}`);
    }
    const next = clone(existing);
    next.status = clone(status);
    next.metadata.resourceVersion = String(Number(existing.metadata.resourceVersion ?? '1') + 1);
    this.store.set(key, next);
    return clone(next);
  }

  delete(kind: string, name: string, namespace = 'default'): boolean {
    return this.store.delete(resourceKey(kind, name, namespace));
  }

  /** Replace store contents (used when hydrating CLI snapshot). */
  replaceAll(resources: PlatformResource[]): void {
    this.store.clear();
    for (const item of resources) {
      const ns = metaNamespace(item.metadata);
      const key = resourceKey(item.kind, item.metadata.name, ns);
      this.store.set(key, clone(item));
    }
  }
}

/**
 * File-backed repository: in-memory semantics with automatic persistence.
 * Used by CLI so apply/get/describe survive process restarts.
 */
export class FileResourceRepository implements ResourceRepository {
  private readonly inner = new InMemoryResourceRepository();

  constructor(private readonly filePath: string) {
    this.load();
  }

  get(kind: string, name: string, namespace = 'default'): PlatformResource | undefined {
    return this.inner.get(kind, name, namespace);
  }

  list(filter?: { kind?: string; namespace?: string }): PlatformResource[] {
    return this.inner.list(filter);
  }

  upsert(resource: PlatformResource): PlatformResource {
    const result = this.inner.upsert(resource);
    this.persist();
    return result;
  }

  updateStatus(
    kind: string,
    name: string,
    status: ResourceStatus,
    namespace = 'default'
  ): PlatformResource {
    const result = this.inner.updateStatus(kind, name, status, namespace);
    this.persist();
    return result;
  }

  delete(kind: string, name: string, namespace = 'default'): boolean {
    const result = this.inner.delete(kind, name, namespace);
    this.persist();
    return result;
  }

  load(): void {
    if (!fs.existsSync(this.filePath)) return;
    hydrateRepository(this.inner, fs.readFileSync(this.filePath, 'utf8'));
  }

  persist(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, serializeRepository(this.inner));
  }

  get path(): string {
    return this.filePath;
  }
}

/** Serialize repository snapshot (for CLI local persistence). */
export function serializeRepository(repo: ResourceRepository): string {
  return JSON.stringify({ apiVersion: 'agent.hazeljs.dev/v1alpha1', items: repo.list() }, null, 2);
}

/** Hydrate an in-memory repository from a prior serializeRepository snapshot. */
export function hydrateRepository(repo: InMemoryResourceRepository, raw: string): void {
  const parsed = JSON.parse(raw) as { items?: PlatformResource[] };
  repo.replaceAll(parsed.items ?? []);
}

export function parseResourceTypeArg(arg: string): {
  kind: string;
  name?: string;
  namespace?: string;
} {
  // Forms: kind | kind/name | namespace/kind/name
  const parts = arg.split('/').filter(Boolean);
  if (parts.length === 1) {
    return { kind: normalizeKind(parts[0]) };
  }
  if (parts.length === 2) {
    return { kind: normalizeKind(parts[0]), name: parts[1] };
  }
  if (parts.length === 3) {
    return { namespace: parts[0], kind: normalizeKind(parts[1]), name: parts[2] };
  }
  throw new Error(`Invalid resource argument: ${arg}`);
}

export function normalizeKind(input: string): string {
  const map: Record<string, ResourceKind> = {
    agentdefinition: 'AgentDefinition',
    agentdefinitions: 'AgentDefinition',
    ad: 'AgentDefinition',
    agentdeployment: 'AgentDeployment',
    agentdeployments: 'AgentDeployment',
    deploy: 'AgentDeployment',
    agentrun: 'AgentRun',
    agentruns: 'AgentRun',
    run: 'AgentRun',
  };
  const key = input.toLowerCase();
  if (map[key]) return map[key];
  // Preserve PascalCase kinds
  if (['AgentDefinition', 'AgentDeployment', 'AgentRun'].includes(input)) return input;
  return input;
}

export type { ResourceRef };
