/**
 * Load project agent modules for `hazel apply` / hazeld.
 *
 * Prefers `agents/index.ts` (AgentModule-style barrel of multiple `@Agent` files),
 * then falls back to root `agent.ts` / `src/agent.ts`.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { getAgentMetadata, getRegisteredAgents } from '../decorators/agent.decorator';
import { getAgentTools, getToolMetadata } from '../decorators/tool.decorator';
import type { DnaToolHandler } from '../dna/bootstrap-from-dna';

export type ProjectAgentModule = {
  filePath: string;
  agentClass: new (...args: unknown[]) => unknown;
  instance: unknown;
  /** Tool name → bound handler (from @Tool methods). */
  handlers: Record<string, DnaToolHandler>;
  /** `@Agent({ name })` when present. */
  name?: string;
};

export type ProjectAgentsBundle = {
  filePath: string;
  agents: ProjectAgentModule[];
};

/** Preferred barrel first (multi-agent), then single-file layouts. */
const CANDIDATES = [
  'agents/index.ts',
  'agents/index.js',
  'agent.ts',
  'agent.js',
  'src/agent.ts',
  'src/agent.js',
] as const;

function ensureTsxRegistered(projectRoot: string): void {
  const req = createRequire(path.join(projectRoot, 'package.json'));
  try {
    req('tsx/cjs');
    return;
  } catch {
    // fall through
  }
  try {
    const api = req('tsx/cjs/api') as { register?: () => void };
    api.register?.();
  } catch {
    throw new Error(
      `Found TypeScript agent entry but cannot load it. Install tsx in this project:\n  npm i -D tsx`
    );
  }
}

function resolveAgentFile(projectRoot: string): string | undefined {
  for (const rel of CANDIDATES) {
    const abs = path.join(projectRoot, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  return undefined;
}

function isAgentClass(value: unknown): value is new (...args: unknown[]) => unknown {
  return (
    typeof value === 'function' && !!getAgentMetadata(value as new (...args: unknown[]) => unknown)
  );
}

function extractHandlers(
  agentClass: new (...args: unknown[]) => unknown,
  instance: object
): Record<string, DnaToolHandler> {
  const methodNames = getAgentTools(agentClass);
  const handlers: Record<string, DnaToolHandler> = {};
  for (const methodName of methodNames) {
    const meta =
      getToolMetadata(instance, methodName) ??
      getToolMetadata(Object.getPrototypeOf(instance) as object, methodName);
    const toolName = meta?.name || methodName;
    const method =
      (typeof meta?.method === 'function' ? meta.method : undefined) ??
      (instance as Record<string, unknown>)[methodName];
    if (typeof method !== 'function') continue;
    handlers[toolName] = async (input: Record<string, unknown>): Promise<unknown> =>
      method.call(instance, input);
  }
  return handlers;
}

function toProjectAgent(
  agentClass: new (...args: unknown[]) => unknown,
  filePath: string
): ProjectAgentModule {
  const meta = getAgentMetadata(agentClass);
  const instance = new agentClass();
  const handlers = extractHandlers(agentClass, instance as object);
  return {
    filePath,
    agentClass,
    instance,
    handlers,
    name: meta?.name,
  };
}

function collectAgentClasses(
  mod: Record<string, unknown>,
  registeredBefore?: Set<new (...args: unknown[]) => unknown>
): Array<new (...args: unknown[]) => unknown> {
  const byName = new Map<string, new (...args: unknown[]) => unknown>();

  const add = (c: new (...args: unknown[]) => unknown): void => {
    const name = getAgentMetadata(c)?.name ?? c.name;
    byName.set(name, c);
  };

  for (const v of Object.values(mod)) {
    if (isAgentClass(v)) add(v);
  }

  // Side-effect imports in agents/index.ts register via @Agent without re-export.
  // Only scan the registry when we have a before-snapshot (from loadAgentModule).
  if (registeredBefore) {
    for (const c of getRegisteredAgents()) {
      if (!registeredBefore.has(c) && isAgentClass(c)) add(c);
    }
  }

  return Array.from(byName.values());
}

function pickAgentClass(
  classes: Array<new (...args: unknown[]) => unknown>,
  preferredName?: string
): (new (...args: unknown[]) => unknown) | undefined {
  if (preferredName) {
    const match = classes.find((c) => getAgentMetadata(c)?.name === preferredName);
    if (match) return match;
    if (classes.length > 1) {
      const names = classes.map((c) => getAgentMetadata(c)?.name ?? c.name).join(', ');
      throw new Error(
        `Multiple @Agent classes in agent module; none named "${preferredName}". Available: ${names}`
      );
    }
    // Sole agent: return it so the caller can report a DNA name mismatch.
    return classes[0];
  }
  if (classes.length >= 1) return classes[0];
  return undefined;
}

/**
 * Build all project agents from an already-loaded module (same Reflect metadata realm).
 */
export function projectAgentsFromModule(
  mod: Record<string, unknown>,
  options: {
    filePath?: string;
    /** When set (loadAgentModule), also collect @Agent classes registered during require. */
    registeredBefore?: Set<new (...args: unknown[]) => unknown>;
  } = {}
): ProjectAgentsBundle {
  const filePath = options.filePath ?? 'agent.ts';
  const classes = collectAgentClasses(mod, options.registeredBefore);
  return {
    filePath,
    agents: classes.map((c) => toProjectAgent(c, filePath)),
  };
}

/**
 * Build a single project agent from an already-loaded module.
 * Used by {@link loadProjectAgent} and unit tests.
 */
export function projectAgentFromModule(
  mod: Record<string, unknown>,
  options: { filePath?: string; preferredAgentName?: string; rootLabel?: string } = {}
): ProjectAgentModule {
  const filePath = options.filePath ?? 'agent.ts';
  const preferredAgentName = options.preferredAgentName;
  const classes = Object.values(mod).filter(isAgentClass);
  const agentClass = pickAgentClass(classes, preferredAgentName);
  if (!agentClass) {
    throw new Error(
      `Loaded ${options.rootLabel ?? filePath} but found no @Agent class. Export a class decorated with @Agent({ name }).`
    );
  }

  const meta = getAgentMetadata(agentClass);
  if (preferredAgentName && meta?.name && meta.name !== preferredAgentName) {
    throw new Error(
      `agent.ts @Agent name "${meta.name}" does not match DNA name "${preferredAgentName}". Align them.`
    );
  }

  return toProjectAgent(agentClass, filePath);
}

function loadAgentModule(projectRoot: string):
  | {
      filePath: string;
      mod: Record<string, unknown>;
      registeredBefore: Set<new (...args: unknown[]) => unknown>;
    }
  | undefined {
  const root = path.resolve(projectRoot);
  const filePath = resolveAgentFile(root);
  if (!filePath) return undefined;

  if (filePath.endsWith('.ts')) {
    ensureTsxRegistered(root);
  }

  const registeredBefore = new Set(getRegisteredAgents());
  const req = createRequire(path.join(root, 'package.json'));
  const resolved = req.resolve(filePath);
  // Hot-reload on re-apply
  delete req.cache[resolved];
  for (const key of Object.keys(req.cache)) {
    if (
      key === resolved ||
      key.startsWith(filePath) ||
      key.includes(`${path.sep}agents${path.sep}`)
    ) {
      delete req.cache[key];
    }
  }

  const mod = req(filePath) as Record<string, unknown>;
  return { filePath, mod, registeredBefore };
}

/**
 * Load all `@Agent` classes from the project barrel / agent entry.
 * Returns undefined when no agent file exists.
 */
export function loadProjectAgents(projectRoot: string): ProjectAgentsBundle | undefined {
  const loaded = loadAgentModule(projectRoot);
  if (!loaded) return undefined;
  const bundle = projectAgentsFromModule(loaded.mod, {
    filePath: loaded.filePath,
    registeredBefore: loaded.registeredBefore,
  });
  if (bundle.agents.length === 0) {
    throw new Error(
      `Loaded ${path.relative(path.resolve(projectRoot), loaded.filePath)} but found no @Agent class. ` +
        `Export classes decorated with @Agent({ name }), or import them from agents/index.ts.`
    );
  }
  return bundle;
}

/**
 * Load a single project agent (DNA name match or sole agent).
 * Returns undefined when no agent file exists (DNA-only apply still works).
 */
export function loadProjectAgent(
  projectRoot: string,
  preferredAgentName?: string
): ProjectAgentModule | undefined {
  const loaded = loadAgentModule(projectRoot);
  if (!loaded) return undefined;

  const root = path.resolve(projectRoot);
  const rootLabel = path.relative(root, loaded.filePath);
  const bundle = projectAgentsFromModule(loaded.mod, {
    filePath: loaded.filePath,
    registeredBefore: loaded.registeredBefore,
  });

  if (bundle.agents.length === 0) {
    throw new Error(
      `Loaded ${rootLabel} but found no @Agent class. Export a class decorated with @Agent({ name }).`
    );
  }

  if (preferredAgentName) {
    const match = bundle.agents.find((a) => a.name === preferredAgentName);
    if (match) return match;
    if (bundle.agents.length === 1) {
      const sole = bundle.agents[0];
      if (sole.name && sole.name !== preferredAgentName) {
        throw new Error(
          `agent.ts @Agent name "${sole.name}" does not match DNA name "${preferredAgentName}". Align them.`
        );
      }
      return sole;
    }
    const names = bundle.agents.map((a) => a.name ?? '(unnamed)').join(', ');
    throw new Error(
      `Multiple @Agent classes in agent module; none named "${preferredAgentName}". Available: ${names}`
    );
  }

  return bundle.agents[0];
}
