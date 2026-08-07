/**
 * Local filesystem Agent OS package registry (G2 Package+Store).
 * Layout: ~/.hazel/registry/<safe-name>/<version>/package.json + index.json
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { assertValidMarketplacePackage, type MarketplaceAgentPackage } from '../dna/agent-dna';
import { saveMarketplacePackage } from '../dna/marketplace';
import { sanitizePackageName } from './package-name';

export interface PackageSummary {
  name: string;
  versions: string[];
  latest: string;
  description?: string;
}

export interface RegistryIndex {
  packages: PackageSummary[];
}

export interface LocalFsAgentRegistryOptions {
  /** Registry root. Default: `$HAZEL_HOME/registry` or `~/.hazel/registry`. */
  rootDir?: string;
}

export function defaultHazelHome(): string {
  return process.env.HAZEL_HOME?.trim() || path.join(os.homedir(), '.hazel');
}

export function defaultRegistryRoot(): string {
  return path.join(defaultHazelHome(), 'registry');
}

export class LocalFsAgentRegistry {
  readonly rootDir: string;

  constructor(options: LocalFsAgentRegistryOptions = {}) {
    this.rootDir = path.resolve(options.rootDir ?? defaultRegistryRoot());
  }

  private indexPath(): string {
    return path.join(this.rootDir, 'index.json');
  }

  private lockPath(): string {
    return path.join(this.rootDir, 'lock.json');
  }

  private packageDir(name: string, version: string): string {
    return path.join(this.rootDir, sanitizePackageName(name), version);
  }

  private packageFile(name: string, version: string): string {
    return path.join(this.packageDir(name, version), 'package.json');
  }

  ensureRoot(): void {
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
    if (!fs.existsSync(this.indexPath())) {
      fs.writeFileSync(this.indexPath(), JSON.stringify({ packages: [] }, null, 2));
    }
  }

  private readIndex(): RegistryIndex {
    this.ensureRoot();
    try {
      const raw = fs.readFileSync(this.indexPath(), 'utf8');
      const parsed = JSON.parse(raw) as RegistryIndex;
      return { packages: Array.isArray(parsed.packages) ? parsed.packages : [] };
    } catch {
      return { packages: [] };
    }
  }

  private writeIndex(index: RegistryIndex): void {
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
    fs.writeFileSync(this.indexPath(), JSON.stringify(index, null, 2));
  }

  private sortVersions(versions: string[]): string[] {
    return [...versions].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  private upsertIndexEntry(pkg: MarketplaceAgentPackage): void {
    const index = this.readIndex();
    let entry = index.packages.find((p) => p.name === pkg.name);
    if (!entry) {
      entry = {
        name: pkg.name,
        versions: [],
        latest: pkg.version,
        description: pkg.description,
      };
      index.packages.push(entry);
    }
    if (!entry.versions.includes(pkg.version)) {
      entry.versions.push(pkg.version);
    }
    entry.versions = this.sortVersions(entry.versions);
    entry.latest = entry.versions[entry.versions.length - 1]!;
    entry.description = pkg.description ?? entry.description;
    index.packages.sort((a, b) => a.name.localeCompare(b.name));
    this.writeIndex(index);
  }

  publish(pkg: MarketplaceAgentPackage): void {
    assertValidMarketplacePackage(pkg);
    this.ensureRoot();
    const dir = this.packageDir(pkg.name, pkg.version);
    fs.mkdirSync(dir, { recursive: true });
    saveMarketplacePackage(pkg, this.packageFile(pkg.name, pkg.version));
    this.upsertIndexEntry(pkg);
    this.writeResolveLock(pkg.name, pkg.version);
  }

  private writeResolveLock(name: string, version: string): void {
    let lock: Record<string, string> = {};
    if (fs.existsSync(this.lockPath())) {
      try {
        lock = JSON.parse(fs.readFileSync(this.lockPath(), 'utf8')) as Record<string, string>;
      } catch {
        lock = {};
      }
    }
    lock[name] = version;
    fs.writeFileSync(this.lockPath(), JSON.stringify(lock, null, 2));
  }

  get(name: string, version?: string): MarketplaceAgentPackage {
    const resolved = this.resolve(name, version);
    return resolved;
  }

  list(query?: string): PackageSummary[] {
    const index = this.readIndex();
    if (!query?.trim()) return index.packages;
    const q = query.trim().toLowerCase();
    return index.packages.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q) ?? false)
    );
  }

  resolve(name: string, rangeOrTag?: string): MarketplaceAgentPackage {
    const index = this.readIndex();
    const entry = index.packages.find((p) => p.name === name);
    if (!entry) {
      throw new Error(`Package not found in local registry: ${name}`);
    }
    const version = !rangeOrTag || rangeOrTag === 'latest' ? entry.latest : rangeOrTag;
    if (!entry.versions.includes(version)) {
      throw new Error(
        `Version ${version} not found for ${name} (have: ${entry.versions.join(', ')})`
      );
    }
    const file = this.packageFile(name, version);
    if (!fs.existsSync(file)) {
      throw new Error(`Missing package file: ${file}`);
    }
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as MarketplaceAgentPackage;
    assertValidMarketplacePackage(raw);
    return raw;
  }

  remove(name: string, version?: string): void {
    const index = this.readIndex();
    const entryIdx = index.packages.findIndex((p) => p.name === name);
    if (entryIdx === -1) {
      throw new Error(`Package not found in local registry: ${name}`);
    }
    const entry = index.packages[entryIdx]!;
    if (version) {
      const file = this.packageFile(name, version);
      const dir = this.packageDir(name, version);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      if (fs.existsSync(dir)) {
        try {
          fs.rmdirSync(dir);
        } catch {
          /* non-empty */
        }
      }
      entry.versions = entry.versions.filter((v) => v !== version);
      if (entry.versions.length === 0) {
        index.packages.splice(entryIdx, 1);
        const pkgRoot = path.join(this.rootDir, sanitizePackageName(name));
        if (fs.existsSync(pkgRoot)) {
          try {
            fs.rmSync(pkgRoot, { recursive: true, force: true });
          } catch {
            /* ignore */
          }
        }
      } else {
        entry.latest = entry.versions[entry.versions.length - 1]!;
      }
    } else {
      const pkgRoot = path.join(this.rootDir, sanitizePackageName(name));
      if (fs.existsSync(pkgRoot)) {
        fs.rmSync(pkgRoot, { recursive: true, force: true });
      }
      index.packages.splice(entryIdx, 1);
    }
    this.writeIndex(index);
  }

  doctor(): { ok: boolean; checks: Array<{ name: string; ok: boolean; detail: string }> } {
    const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
    this.ensureRoot();
    const rootExists = fs.existsSync(this.rootDir);
    checks.push({
      name: 'registry_root',
      ok: rootExists,
      detail: rootExists ? this.rootDir : `missing: ${this.rootDir}`,
    });
    let indexOk = false;
    let indexDetail = '';
    try {
      const index = this.readIndex();
      indexOk = true;
      indexDetail = `${index.packages.length} package(s)`;
    } catch (e) {
      indexDetail = e instanceof Error ? e.message : String(e);
    }
    checks.push({ name: 'index', ok: indexOk, detail: indexDetail });
    const lockExists = fs.existsSync(this.lockPath());
    checks.push({
      name: 'lock',
      ok: true,
      detail: lockExists ? this.lockPath() : 'no lock yet (ok)',
    });
    return { ok: checks.every((c) => c.ok), checks };
  }
}
