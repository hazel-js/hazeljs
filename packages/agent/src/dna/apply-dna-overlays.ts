/**
 * Apply marketplace / platform DNA onto a live AgentRuntime without replacing @Tool handlers.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseDna, type AgentDna } from './agent-dna';
import { loadMarketplacePackage } from './marketplace';
import type { HotReloadResult } from './hot-reload';
import { createLocalPlatform } from '../platform/local-platform';
import type { AgentDefinition } from '../platform/resources';
import { logger } from '../utils/logger';

export interface DnaOverlayTarget {
  getAgentMetadata(name: string): unknown;
  hotReloadDna(dna: AgentDna): HotReloadResult;
}

export interface DnaOverlayEntry {
  source: 'platform' | 'file';
  definitionName?: string;
  result: HotReloadResult;
}

export interface DnaOverlayReport {
  enabled: boolean;
  applied: DnaOverlayEntry[];
  skipped: string[];
}

export interface ApplyDnaOverlaysOptions {
  projectRoot?: string;
  env?: NodeJS.ProcessEnv;
  /** Called after each successful overlay (e.g. merge Gatekeeper policies). */
  onApplied?: (dna: AgentDna) => void;
  registryRoot?: string;
}

/** Prompt/policy/model overlay — never re-register DNA tool stubs. */
export function overlayDnaWithoutTools(dna: AgentDna): AgentDna {
  const { tools: _tools, ...rest } = dna;
  return parseDna(rest as AgentDna);
}

function overlayEnabled(env: NodeJS.ProcessEnv): boolean {
  const v = env.AGENT_OS_DNA_OVERLAY?.trim();
  if (v === '0' || v === 'false' || v === 'off') return false;
  return true;
}

function platformStorePath(projectRoot: string, env: NodeJS.ProcessEnv): string {
  return (
    env.AGENT_OS_PLATFORM_STORE?.trim() ||
    path.join(projectRoot, '.hazel', 'platform', 'resources.json')
  );
}

function defaultMarketplacePath(projectRoot: string, env: NodeJS.ProcessEnv): string {
  return (
    env.AGENT_OS_DNA_OVERLAY_FILE?.trim() ||
    path.join(projectRoot, 'dna', 'support-desk.marketplace.json')
  );
}

function dnaFromMarketplaceDir(projectRoot: string): AgentDna[] {
  const dir = path.join(projectRoot, 'dna');
  if (!fs.existsSync(dir)) return [];
  const out: AgentDna[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.marketplace.json')) continue;
    try {
      out.push(loadMarketplacePackage(path.join(dir, file)).dna);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[dna-overlay] skip ${file}: ${msg}`);
    }
  }
  return out;
}

async function dnaFromPlatform(
  projectRoot: string,
  env: NodeJS.ProcessEnv,
  registryRoot?: string
): Promise<Array<{ definitionName: string; dna: AgentDna }>> {
  const storePath = platformStorePath(projectRoot, env);
  if (!fs.existsSync(storePath)) return [];

  const platform = createLocalPlatform({
    storePath,
    projectRoot,
    registryRoot: registryRoot ?? path.join(projectRoot, '.hazel', 'registry'),
    events: false,
  });

  const defs = platform.repo.list({ kind: 'AgentDefinition' }) as AgentDefinition[];
  const out: Array<{ definitionName: string; dna: AgentDna }> = [];

  for (const def of defs) {
    try {
      const resolved = await platform.reconciler.resolveDefinition(def);
      out.push({ definitionName: def.metadata.name, dna: resolved.dna });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[dna-overlay] skip Definition "${def.metadata.name}": ${msg}`);
    }
  }
  return out;
}

function dnaFromFile(projectRoot: string, env: NodeJS.ProcessEnv): AgentDna | undefined {
  const filePath = defaultMarketplacePath(projectRoot, env);
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return loadMarketplacePackage(filePath).dna;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[dna-overlay] skip file ${filePath}: ${msg}`);
    return undefined;
  }
}

/**
 * Overlay platform Definitions then marketplace files onto registered agents.
 * Disable with `AGENT_OS_DNA_OVERLAY=0`.
 */
export async function applyDnaOverlays(
  runtime: DnaOverlayTarget,
  options: ApplyDnaOverlaysOptions = {}
): Promise<DnaOverlayReport> {
  const env = options.env ?? process.env;
  const projectRoot = options.projectRoot ?? process.cwd();

  if (!overlayEnabled(env)) {
    return { enabled: false, applied: [], skipped: ['AGENT_OS_DNA_OVERLAY=0'] };
  }

  const applied: DnaOverlayEntry[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  const applyOne = (
    dna: AgentDna,
    source: DnaOverlayEntry['source'],
    definitionName?: string
  ): void => {
    if (!runtime.getAgentMetadata(dna.name)) {
      skipped.push(
        `${source}${definitionName ? ':' + definitionName : ''} → agent "${dna.name}" not registered`
      );
      return;
    }
    if (seen.has(dna.name)) {
      skipped.push(`${source} → "${dna.name}" already overlaid`);
      return;
    }
    const result = runtime.hotReloadDna(overlayDnaWithoutTools(dna));
    options.onApplied?.(dna);
    seen.add(dna.name);
    applied.push({ source, definitionName, result });
  };

  const fromPlatform = await dnaFromPlatform(projectRoot, env, options.registryRoot);
  for (const { definitionName, dna } of fromPlatform) {
    applyOne(dna, 'platform', definitionName);
  }

  const fileDnas = env.AGENT_OS_DNA_OVERLAY_FILE?.trim()
    ? ((): AgentDna[] => {
        const one = dnaFromFile(projectRoot, env);
        return one ? [one] : [];
      })()
    : dnaFromMarketplaceDir(projectRoot);

  for (const fileDna of fileDnas) {
    applyOne(fileDna, 'file');
  }

  if (!fromPlatform.length && !fileDnas.length) {
    skipped.push('no platform Definitions and no marketplace overlay files');
  }

  return { enabled: true, applied, skipped };
}

export function formatDnaOverlayReport(report: DnaOverlayReport): string {
  if (!report.enabled) return 'DNA overlay disabled';
  if (!report.applied.length) {
    return `DNA overlay: nothing applied (${report.skipped.join('; ') || 'no sources'})`;
  }
  const lines = report.applied.map((e) => {
    const fields = e.result.updated.length ? e.result.updated.join(',') : 'no-op';
    const src = e.source === 'platform' ? `platform/${e.definitionName}` : 'file';
    return `${e.result.agentName}@${e.result.dnaVersion} ← ${src} [${fields}]`;
  });
  return `DNA overlay: ${lines.join('; ')}`;
}
