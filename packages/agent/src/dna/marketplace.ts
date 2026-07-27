/**
 * Marketplace helpers — install agent DNA packages from disk / JSON.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  parseDna,
  toMarketplacePackage,
  type AgentDna,
  type MarketplaceAgentPackage,
} from './agent-dna';
import { hotReloadAgentDna, type HotReloadTarget } from './hot-reload';

export function loadMarketplacePackage(filePath: string): MarketplaceAgentPackage {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
  const json = JSON.parse(raw) as MarketplaceAgentPackage | AgentDna;
  if ((json as MarketplaceAgentPackage).dna) {
    const pkg = json as MarketplaceAgentPackage;
    pkg.dna = parseDna(pkg.dna);
    return pkg;
  }
  const dna = parseDna(json as AgentDna);
  return toMarketplacePackage(dna);
}

export function saveMarketplacePackage(pkg: MarketplaceAgentPackage, filePath: string): void {
  const out = path.resolve(filePath);
  const dir = path.dirname(out);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(out, JSON.stringify(pkg, null, 2));
}

/**
 * Install a DNA / marketplace package into a live runtime (hot-reload).
 */
export function installAgentPackage(
  target: HotReloadTarget,
  source: string | MarketplaceAgentPackage | AgentDna
): ReturnType<typeof hotReloadAgentDna> {
  if (typeof source === 'string') {
    const pkg = loadMarketplacePackage(source);
    return hotReloadAgentDna(target, pkg.dna);
  }
  if ('dna' in source && (source as MarketplaceAgentPackage).dna) {
    return hotReloadAgentDna(target, (source as MarketplaceAgentPackage).dna);
  }
  return hotReloadAgentDna(target, source as AgentDna);
}
