/**
 * Factory helpers for local vs hosted (remote) AgentPackageRegistry.
 */

import {
  LocalFsAgentRegistry,
  defaultRegistryRoot,
  type LocalFsAgentRegistryOptions,
} from './local-fs-registry';
import { HttpAgentPackageRegistry, type HttpAgentPackageRegistryOptions } from './http-registry';
import { InMemoryAgentPackageRegistry } from './in-memory-registry';
import type { AgentPackageRegistry } from './registry';
import type { MarketplaceAgentPackage } from '../dna/agent-dna';
import type { PackageSummary } from './local-fs-registry';
import type { RegistryDoctorReport } from './registry';

/** Adapt sync LocalFsAgentRegistry to the async AgentPackageRegistry contract. */
export class LocalFsAgentRegistryAdapter implements AgentPackageRegistry {
  readonly kind = 'local' as const;
  readonly location: string;
  private readonly inner: LocalFsAgentRegistry;

  constructor(options: LocalFsAgentRegistryOptions = {}) {
    this.inner = new LocalFsAgentRegistry(options);
    this.location = this.inner.rootDir;
  }

  get rootDir(): string {
    return this.inner.rootDir;
  }

  async publish(pkg: MarketplaceAgentPackage): Promise<void> {
    this.inner.publish(pkg);
  }

  async get(name: string, version?: string): Promise<MarketplaceAgentPackage> {
    return this.inner.get(name, version);
  }

  async list(query?: string): Promise<PackageSummary[]> {
    return this.inner.list(query);
  }

  async remove(name: string, version?: string): Promise<void> {
    this.inner.remove(name, version);
  }

  async doctor(): Promise<RegistryDoctorReport> {
    return this.inner.doctor();
  }
}

export interface CreateAgentPackageRegistryOptions {
  /** Hosted registry base URL (HAZEL_REGISTRY_URL). */
  remote?: string;
  /** Bearer token (HAZEL_REGISTRY_TOKEN). */
  token?: string;
  /** Local filesystem root when not using remote. */
  registryRoot?: string;
  /** Force in-memory (tests). */
  memory?: boolean;
  fetch?: HttpAgentPackageRegistryOptions['fetch'];
}

export function createAgentPackageRegistry(
  options: CreateAgentPackageRegistryOptions = {}
): AgentPackageRegistry {
  if (options.memory) return new InMemoryAgentPackageRegistry();
  const remote = (options.remote ?? process.env.HAZEL_REGISTRY_URL)?.trim();
  if (remote) {
    return new HttpAgentPackageRegistry({
      baseUrl: remote,
      token: options.token ?? process.env.HAZEL_REGISTRY_TOKEN,
      fetch: options.fetch,
    });
  }
  return new LocalFsAgentRegistryAdapter({
    rootDir: options.registryRoot ?? defaultRegistryRoot(),
  });
}
