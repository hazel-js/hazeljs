/**
 * Resolve marketplace packageRef → DNA from project agents and/or local registry.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AgentDna, MarketplaceAgentPackage } from '../dna/agent-dna';
import { assertValidMarketplacePackage } from '../dna/agent-dna';
import { LocalFsAgentRegistry, defaultRegistryRoot } from '../store/local-fs-registry';
import type { AgentPackageRegistry } from '../store/registry';
import {
  projectAgentsDir,
  projectAgentsLockPath,
  type ProjectAgentLock,
} from '../store/materialize';
import type { PackageRef } from './resources';
import { PlatformValidationError } from './schemas';

export type PackageResolveSource = 'project' | 'registry' | 'remote' | 'custom';

export interface ResolvedPackage {
  dna: AgentDna;
  name: string;
  version: string;
  source: PackageResolveSource;
  path?: string;
}

export type PackageResolver = (ref: PackageRef) => ResolvedPackage | Promise<ResolvedPackage>;

export interface CompositePackageResolverOptions {
  /** Project root containing `.hazel/agents` (checked first). */
  projectRoot?: string;
  /** Local registry root (default: ~/.hazel/registry). */
  registryRoot?: string;
  /** Skip local filesystem registry lookup. */
  registry?: boolean;
  /**
   * Hosted / remote AgentPackageRegistry (Cloud Team SKU).
   * Tried after project + local registry.
   */
  remoteRegistry?: AgentPackageRegistry;
}

function readProjectLock(projectRoot: string): ProjectAgentLock {
  const lockPath = projectAgentsLockPath(projectRoot);
  if (!fs.existsSync(lockPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8')) as ProjectAgentLock;
  } catch {
    return {};
  }
}

function loadPackageFile(filePath: string): MarketplaceAgentPackage {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as MarketplaceAgentPackage;
  assertValidMarketplacePackage(raw);
  return raw;
}

function tryResolveFromProject(projectRoot: string, ref: PackageRef): ResolvedPackage | undefined {
  const lock = readProjectLock(projectRoot);
  const entry = lock[ref.name];
  if (!entry) {
    // Fallback: scan .hazel/agents/*/package.json by package name
    const agentsDir = projectAgentsDir(projectRoot);
    if (!fs.existsSync(agentsDir)) return undefined;
    for (const ent of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const pkgPath = path.join(agentsDir, ent.name, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;
      try {
        const pkg = loadPackageFile(pkgPath);
        if (pkg.name !== ref.name) continue;
        if (ref.version && ref.version !== 'latest' && pkg.version !== ref.version) continue;
        return {
          dna: pkg.dna,
          name: pkg.name,
          version: pkg.version,
          source: 'project',
          path: pkgPath,
        };
      } catch {
        continue;
      }
    }
    return undefined;
  }

  if (ref.version && ref.version !== 'latest' && entry.version !== ref.version) {
    return undefined;
  }

  const pkgPath = path.isAbsolute(entry.path)
    ? entry.path
    : path.join(path.resolve(projectRoot), entry.path);
  if (!fs.existsSync(pkgPath)) return undefined;
  const pkg = loadPackageFile(pkgPath);
  return {
    dna: pkg.dna,
    name: pkg.name,
    version: pkg.version,
    source: 'project',
    path: pkgPath,
  };
}

function tryResolveFromRegistry(
  registryRoot: string,
  ref: PackageRef
): ResolvedPackage | undefined {
  const registry = new LocalFsAgentRegistry({ rootDir: registryRoot });
  try {
    const pkg = registry.get(
      ref.name,
      ref.version && ref.version !== 'latest' ? ref.version : undefined
    );
    return {
      dna: pkg.dna,
      name: pkg.name,
      version: pkg.version,
      source: 'registry',
      path: path.join(
        registry.rootDir,
        // path is informational; get already validated existence
        pkg.name,
        pkg.version
      ),
    };
  } catch {
    return undefined;
  }
}

/**
 * Resolve packageRef from project `.hazel/agents` first, then local registry,
 * then optional hosted remote registry.
 */
export function createCompositePackageResolver(
  options: CompositePackageResolverOptions = {}
): PackageResolver {
  const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : undefined;
  const registryRoot =
    options.registry === false
      ? undefined
      : path.resolve(options.registryRoot ?? defaultRegistryRoot());
  const remoteRegistry = options.remoteRegistry;

  return async (ref: PackageRef): Promise<ResolvedPackage> => {
    const attempts: string[] = [];

    if (projectRoot) {
      const fromProject = tryResolveFromProject(projectRoot, ref);
      if (fromProject) return fromProject;
      attempts.push(`project ${path.join(projectRoot, '.hazel', 'agents')} (lock/materialized)`);
    }

    if (registryRoot) {
      const fromRegistry = tryResolveFromRegistry(registryRoot, ref);
      if (fromRegistry) return fromRegistry;
      attempts.push(`registry ${registryRoot}`);
    }

    if (remoteRegistry) {
      try {
        const pkg = await remoteRegistry.get(
          ref.name,
          ref.version && ref.version !== 'latest' ? ref.version : undefined
        );
        return {
          dna: pkg.dna,
          name: pkg.name,
          version: pkg.version,
          source: 'remote',
          path: remoteRegistry.location,
        };
      } catch {
        attempts.push(`remote ${remoteRegistry.location}`);
      }
    }

    const versionHint = ref.version ? `@${ref.version}` : '@latest';
    throw new PlatformValidationError('Package not found', [
      `${ref.name}${versionHint}`,
      attempts.length
        ? `searched: ${attempts.join('; ')}`
        : 'no projectRoot or registry configured',
      'hint: hazel store publish <pkg> && hazel store install <name>@<version>',
      'hint: hazel store publish <pkg> --remote <url> --token <token> (Cloud Team registry)',
    ]);
  };
}

/** Adapter: PackageResolver that only wraps a LocalFsAgentRegistry. */
export function createPackageResolverFromRegistry(registryRoot: string): PackageResolver {
  return createCompositePackageResolver({
    registryRoot,
    registry: true,
  });
}
