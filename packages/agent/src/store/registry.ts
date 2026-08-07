/**
 * Portable Agent OS package registry contract (local FS + hosted Cloud Team SKU).
 */

import type { MarketplaceAgentPackage } from '../dna/agent-dna';
import type { PackageSummary } from './local-fs-registry';

export interface RegistryDoctorReport {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
}

/**
 * Shared registry API. Local implementations may be sync; remote is async.
 * Callers should always `await`.
 */
export interface AgentPackageRegistry {
  readonly kind: 'local' | 'remote' | 'memory';
  /** Human-readable endpoint (filesystem path or HTTPS base URL). */
  readonly location: string;
  publish(pkg: MarketplaceAgentPackage): Promise<void>;
  get(name: string, version?: string): Promise<MarketplaceAgentPackage>;
  list(query?: string): Promise<PackageSummary[]>;
  remove(name: string, version?: string): Promise<void>;
  doctor(): Promise<RegistryDoctorReport>;
}
