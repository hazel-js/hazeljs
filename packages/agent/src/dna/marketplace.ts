/**
 * Marketplace helpers — install agent DNA packages from disk / JSON.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  assertValidMarketplacePackage,
  parseDna,
  toMarketplacePackage,
  type AgentDna,
  type MarketplaceAgentPackage,
} from './agent-dna';
import { hotReloadAgentDna, type HotReloadTarget } from './hot-reload';

export function loadMarketplacePackage(filePath: string): MarketplaceAgentPackage {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
  const json = JSON.parse(raw) as MarketplaceAgentPackage | AgentDna;
  let pkg: MarketplaceAgentPackage;
  if ((json as MarketplaceAgentPackage).dna) {
    const loaded = json as MarketplaceAgentPackage;
    loaded.dna = parseDna(loaded.dna);
    pkg = loaded;
  } else {
    const dna = parseDna(json as AgentDna);
    pkg = toMarketplacePackage(dna);
  }
  assertValidMarketplacePackage(pkg);
  return pkg;
}

export function saveMarketplacePackage(pkg: MarketplaceAgentPackage, filePath: string): void {
  assertValidMarketplacePackage(pkg);
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
    assertValidMarketplacePackage(source);
    return hotReloadAgentDna(target, (source as MarketplaceAgentPackage).dna);
  }
  return hotReloadAgentDna(target, source as AgentDna);
}
