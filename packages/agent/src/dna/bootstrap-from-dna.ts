/**
 * Bootstrap AgentRuntime from Agent DNA (CLI / embedded runners).
 */

import { Agent } from '../decorators/agent.decorator';
import { AgentRuntime, type AgentRuntimeConfig } from '../runtime/agent.runtime';
import { createDurableRunStore, type DurableRunStore } from '../run/durable-run-store';
import { FileTimelineStore } from '../timeline/timeline.store';
import type { LLMProvider } from '../types/llm.types';
import { parseDna, type AgentDna, type MarketplaceAgentPackage } from './agent-dna';
import { loadMarketplacePackage } from './marketplace';

export type DnaToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

export interface BootstrapFromDnaOptions {
  llmProvider: LLMProvider;
  /** Durable file store directory (runs + checkpoints + human-tasks + a2a). */
  storeDir?: string;
  /** Timeline JSONL path (default: `<storeDir>/timeline.jsonl` when storeDir set). */
  timelinePath?: string;
  durableSuspend?: boolean;
  workerId?: string;
  runLeaseTtlMs?: number;
  /** Per-tool handlers keyed by tool name. Missing tools get stubs when stubTools. */
  toolHandlers?: Record<string, DnaToolHandler>;
  /** Register stub handlers for tools without handlers (default true). */
  stubTools?: boolean;
  /** Extra AgentRuntime config overrides. */
  runtime?: Omit<
    AgentRuntimeConfig,
    'llmProvider' | 'runRepository' | 'checkpointService' | 'humanTaskService' | 'timelineStore'
  >;
}

export interface BootstrapFromDnaResult {
  runtime: AgentRuntime;
  dna: AgentDna;
  store?: DurableRunStore;
  timelinePath?: string;
}

export function resolveDnaSource(source: string | AgentDna | MarketplaceAgentPackage): AgentDna {
  if (typeof source === 'string') {
    return loadMarketplacePackage(source).dna;
  }
  if ('dna' in source && (source as MarketplaceAgentPackage).dna) {
    return parseDna((source as MarketplaceAgentPackage).dna);
  }
  return parseDna(source as AgentDna);
}

/**
 * Create an @Agent-decorated class from DNA (for registerAgent).
 */
export function createAgentClassFromDna(dna: AgentDna): new () => unknown {
  class DnaBootstrappedAgent {}
  Object.defineProperty(DnaBootstrappedAgent, 'name', { value: `Dna_${dna.name}` });
  const caps = dna.metadata?.capabilities;
  Agent({
    name: dna.name,
    description: dna.description ?? dna.name,
    systemPrompt: dna.systemPrompt ?? `You are ${dna.name}, a HazelJS agent.`,
    model: dna.model,
    version: dna.version,
    capabilities: Array.isArray(caps) ? (caps as string[]) : undefined,
    metadata: dna.metadata,
  })(DnaBootstrappedAgent);
  return DnaBootstrappedAgent as unknown as new () => unknown;
}

/**
 * Build a ready-to-execute AgentRuntime from DNA / marketplace package / file path.
 */
export function bootstrapRuntimeFromDna(
  source: string | AgentDna | MarketplaceAgentPackage,
  options: BootstrapFromDnaOptions
): BootstrapFromDnaResult {
  const dna = resolveDnaSource(source);
  const stubTools = options.stubTools !== false;
  const store = options.storeDir ? createDurableRunStore(options.storeDir) : undefined;
  const timelinePath =
    options.timelinePath ??
    (options.storeDir ? `${options.storeDir.replace(/\/$/, '')}/timeline.jsonl` : undefined);

  const runtime = new AgentRuntime({
    ...options.runtime,
    llmProvider: options.llmProvider,
    durableSuspend: options.durableSuspend ?? true,
    workerId: options.workerId,
    runLeaseTtlMs: options.runLeaseTtlMs,
    enableRetry: options.runtime?.enableRetry ?? false,
    enableCircuitBreaker: options.runtime?.enableCircuitBreaker ?? false,
    runRepository: store?.runRepository,
    checkpointService: store?.checkpointService,
    humanTaskService: store?.humanTaskService,
    timelineStore: timelinePath ? new FileTimelineStore(timelinePath) : undefined,
  });

  const Klass = createAgentClassFromDna(dna);
  runtime.registerAgent(Klass);
  runtime.registerAgentInstance(dna.name, new Klass());

  for (const tool of dna.tools ?? []) {
    const handler =
      options.toolHandlers?.[tool.name] ??
      (stubTools
        ? async (input: Record<string, unknown>) => ({
            ok: true,
            tool: tool.name,
            input,
            stub: true,
          })
        : undefined);
    runtime.registerDynamicTool(dna.name, {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      requiresApproval: tool.requiresApproval,
      handler,
    });
  }

  if (dna.policies?.length) {
    runtime.hotReloadDna(dna);
  }

  return { runtime, dna, store, timelinePath };
}
