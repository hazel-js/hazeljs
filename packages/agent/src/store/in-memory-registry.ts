/**
 * In-memory registry — tests and Cloud API mock backends.
 */

import {
  assertValidMarketplacePackage,
  type MarketplaceAgentPackage,
} from '../dna/agent-dna';
import type { PackageSummary } from './local-fs-registry';
import type { AgentPackageRegistry, RegistryDoctorReport } from './registry';

export class InMemoryAgentPackageRegistry implements AgentPackageRegistry {
  readonly kind = 'memory' as const;
  readonly location = 'memory://';
  private readonly packages = new Map<string, Map<string, MarketplaceAgentPackage>>();

  async publish(pkg: MarketplaceAgentPackage): Promise<void> {
    assertValidMarketplacePackage(pkg);
    let versions = this.packages.get(pkg.name);
    if (!versions) {
      versions = new Map();
      this.packages.set(pkg.name, versions);
    }
    versions.set(pkg.version, structuredClone(pkg));
  }

  async get(name: string, version?: string): Promise<MarketplaceAgentPackage> {
    const versions = this.packages.get(name);
    if (!versions || versions.size === 0) {
      throw new Error(`Package not found in memory registry: ${name}`);
    }
    const resolved =
      !version || version === 'latest'
        ? [...versions.keys()].sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
          ).at(-1)!
        : version;
    const pkg = versions.get(resolved);
    if (!pkg) {
      throw new Error(
        `Version ${resolved} not found for ${name} (have: ${[...versions.keys()].join(', ')})`
      );
    }
    return structuredClone(pkg);
  }

  async list(query?: string): Promise<PackageSummary[]> {
    const out: PackageSummary[] = [];
    for (const [name, versions] of this.packages) {
      const sorted = [...versions.keys()].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );
      const latest = sorted[sorted.length - 1]!;
      const description = versions.get(latest)?.description;
      out.push({ name, versions: sorted, latest, description });
    }
    if (!query?.trim()) return out.sort((a, b) => a.name.localeCompare(b.name));
    const q = query.trim().toLowerCase();
    return out
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async remove(name: string, version?: string): Promise<void> {
    const versions = this.packages.get(name);
    if (!versions) throw new Error(`Package not found in memory registry: ${name}`);
    if (version) {
      if (!versions.delete(version)) {
        throw new Error(`Version ${version} not found for ${name}`);
      }
      if (versions.size === 0) this.packages.delete(name);
    } else {
      this.packages.delete(name);
    }
  }

  async doctor(): Promise<RegistryDoctorReport> {
    return {
      ok: true,
      checks: [
        {
          name: 'memory_registry',
          ok: true,
          detail: `${this.packages.size} package(s)`,
        },
      ],
    };
  }
}
