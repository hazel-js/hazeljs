/**
 * Materialize a marketplace package into a project workspace (.hazel/agents).
 */

import * as fs from 'fs';
import * as path from 'path';
import { assertValidMarketplacePackage, type MarketplaceAgentPackage } from '../dna/agent-dna';
import { saveMarketplacePackage } from '../dna/marketplace';
import { sanitizePackageName } from './package-name';

export interface ProjectAgentLockEntry {
  version: string;
  path: string;
}

export type ProjectAgentLock = Record<string, ProjectAgentLockEntry>;

export interface MaterializeResult {
  packageName: string;
  version: string;
  packagePath: string;
  lockPath: string;
}

export function projectAgentsDir(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), '.hazel', 'agents');
}

export function projectAgentsLockPath(projectRoot: string): string {
  return path.join(projectAgentsDir(projectRoot), 'lock.json');
}

function readLock(lockPath: string): ProjectAgentLock {
  if (!fs.existsSync(lockPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8')) as ProjectAgentLock;
  } catch {
    return {};
  }
}

/**
 * Write marketplace package into `.hazel/agents/<safe-name>/package.json`
 * and update `.hazel/agents/lock.json`.
 */
export function materializeAgentPackage(
  pkg: MarketplaceAgentPackage,
  projectRoot: string
): MaterializeResult {
  assertValidMarketplacePackage(pkg);
  const agentsDir = projectAgentsDir(projectRoot);
  const safe = sanitizePackageName(pkg.name);
  const destDir = path.join(agentsDir, safe);
  const packagePath = path.join(destDir, 'package.json');
  const lockPath = projectAgentsLockPath(projectRoot);

  fs.mkdirSync(destDir, { recursive: true });
  saveMarketplacePackage(pkg, packagePath);

  const lock = readLock(lockPath);
  lock[pkg.name] = {
    version: pkg.version,
    path: path.relative(path.resolve(projectRoot), packagePath),
  };
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2));

  return {
    packageName: pkg.name,
    version: pkg.version,
    packagePath,
    lockPath,
  };
}
