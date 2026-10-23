/**
 * Load `./agent.ts` (or agent.js) from the project root so `hazel apply`
 * wires real `@Tool` handlers into hazeld — not DNA stubs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { getAgentMetadata } from '../decorators/agent.decorator';
import { getAgentTools, getToolMetadata } from '../decorators/tool.decorator';
import type { DnaToolHandler } from '../dna/bootstrap-from-dna';

export type ProjectAgentModule = {
  filePath: string;
  agentClass: new (...args: unknown[]) => unknown;
  instance: unknown;
  /** Tool name → bound handler (from @Tool methods). */
  handlers: Record<string, DnaToolHandler>;
};

const CANDIDATES = ['agent.ts', 'agent.js', 'src/agent.ts', 'src/agent.js'] as const;

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
      `Found agent.ts but cannot load TypeScript. Install tsx in this project:\n  npm i -D tsx`
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

function pickAgentClass(
  mod: Record<string, unknown>,
  preferredName?: string
): (new (...args: unknown[]) => unknown) | undefined {
  const classes = Object.values(mod).filter(isAgentClass);
  if (preferredName) {
    const match = classes.find((c) => getAgentMetadata(c)?.name === preferredName);
    if (match) return match;
  }
  if (classes.length === 1) return classes[0];
  if (classes.length > 1 && preferredName) {
    throw new Error(
      `Multiple @Agent classes in agent module; none named "${preferredName}". Export one agent or match dna.name.`
    );
  }
  return classes[0];
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
    handlers[toolName] = async (input: Record<string, unknown>) => method.call(instance, input);
  }
  return handlers;
}

/**
 * Load project agent handlers from cwd/projectRoot.
 * Returns undefined when no agent file exists (DNA-only apply still works).
 */
export function loadProjectAgent(
  projectRoot: string,
  preferredAgentName?: string
): ProjectAgentModule | undefined {
  const root = path.resolve(projectRoot);
  const filePath = resolveAgentFile(root);
  if (!filePath) return undefined;

  if (filePath.endsWith('.ts')) {
    ensureTsxRegistered(root);
  }

  const req = createRequire(path.join(root, 'package.json'));
  const resolved = req.resolve(filePath);
  // Hot-reload on re-apply
  delete req.cache[resolved];
  // Also drop dependents that may hold the old module
  for (const key of Object.keys(req.cache)) {
    if (key === resolved || key.startsWith(filePath)) {
      delete req.cache[key];
    }
  }

  const mod = req(filePath) as Record<string, unknown>;
  const agentClass = pickAgentClass(mod, preferredAgentName);
  if (!agentClass) {
    throw new Error(
      `Loaded ${path.relative(root, filePath)} but found no @Agent class. Export a class decorated with @Agent({ name }).`
    );
  }

  const meta = getAgentMetadata(agentClass);
  if (preferredAgentName && meta?.name && meta.name !== preferredAgentName) {
    throw new Error(
      `agent.ts @Agent name "${meta.name}" does not match DNA name "${preferredAgentName}". Align them.`
    );
  }

  const instance = new agentClass();
  const handlers = extractHandlers(agentClass, instance as object);

  return { filePath, agentClass, instance, handlers };
}
