/**
 * Attach Agent VM to an AgentRuntime — creates the stack and wires EffectGate.
 */

import type { IAgentStateManager, IToolEffectGate, ToolMetadata } from '@hazeljs/agent';
import {
  createAgentVmRuntime,
  type AgentVmRuntimeBundle,
  type CreateAgentVmRuntimeOptions,
} from './create-agent-vm-runtime';

/**
 * Minimal AgentRuntime surface needed to attach Agent VM.
 * Implemented by `@hazeljs/agent` AgentRuntime.
 */
export interface AgentVmAttachableRuntime {
  getStateManager(): IAgentStateManager;
  getAgentInstance(agentName: string): unknown | undefined;
  getAgentTools(agentName: string): ToolMetadata[];
  setEffectGate(gate: IToolEffectGate | undefined): void;
}

export type AttachAgentVmOptions = Omit<
  CreateAgentVmRuntimeOptions,
  'stateManager' | 'resolveAgentInstance' | 'resolveTool'
> & {
  /** Override default resolvers derived from the runtime. */
  resolveAgentInstance?: (agentId: string) => unknown;
  resolveTool?: (agentId: string, toolPropertyKey: string) => ToolMetadata | undefined;
};

/**
 * Build an Agent VM stack from an AgentRuntime (state + agent/tool resolvers).
 * Does not wire ToolExecutor — call {@link attachAgentVm} for that.
 */
export function createAgentVmFromRuntime(
  runtime: AgentVmAttachableRuntime,
  options: AttachAgentVmOptions = {}
): AgentVmRuntimeBundle {
  const {
    resolveAgentInstance = (agentId) => runtime.getAgentInstance(agentId),
    resolveTool = (agentId, toolPropertyKey) => {
      const tools = runtime.getAgentTools(agentId);
      return tools.find(
        (t) => t.propertyKey === toolPropertyKey || t.name === toolPropertyKey
      );
    },
    ...rest
  } = options;

  return createAgentVmRuntime({
    ...rest,
    stateManager: runtime.getStateManager(),
    resolveAgentInstance,
    resolveTool,
  });
}

/**
 * Create Agent VM from the runtime and wire `runtime.setEffectGate(vm.effectGate)`.
 */
export function attachAgentVm(
  runtime: AgentVmAttachableRuntime,
  options: AttachAgentVmOptions = {}
): AgentVmRuntimeBundle {
  const vm = createAgentVmFromRuntime(runtime, options);
  runtime.setEffectGate(vm.effectGate);
  return vm;
}

const bound = new WeakMap<object, AgentVmRuntimeBundle>();

/** Remember the VM bundle for a runtime (e.g. for status / undo APIs). */
export function bindAgentVm(runtime: object, bundle: AgentVmRuntimeBundle): void {
  bound.set(runtime, bundle);
}

/** Look up a previously bound VM bundle. */
export function getBoundAgentVm(runtime: object): AgentVmRuntimeBundle | undefined {
  return bound.get(runtime);
}

/**
 * Attach Agent VM and bind the bundle on the runtime for later lookup.
 */
export function attachAndBindAgentVm(
  runtime: AgentVmAttachableRuntime,
  options: AttachAgentVmOptions = {}
): AgentVmRuntimeBundle {
  const vm = attachAgentVm(runtime, options);
  bindAgentVm(runtime, vm);
  return vm;
}

export type AgentVmBarrierMode = 'converge' | 'abort' | 'store-buffer';

export interface AttachAgentVmFromEnvOptions extends AttachAgentVmOptions {
  env?: NodeJS.ProcessEnv;
  enabledEnv?: string;
  barrierEnv?: string;
  storeBufferEnv?: string;
}

export function agentVmEnabledFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  enabledEnv = 'AGENT_OS_AGENT_VM'
): boolean {
  return env[enabledEnv]?.trim() === '1';
}

export function agentVmBarrierModeFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  barrierEnv = 'AGENT_OS_AGENT_VM_BARRIER'
): AgentVmBarrierMode {
  const v = env[barrierEnv]?.trim().toLowerCase();
  if (v === 'abort' || v === 'store-buffer' || v === 'converge') return v;
  return 'converge';
}

/**
 * Opt-in attach via `AGENT_OS_AGENT_VM=1`. Returns undefined when disabled.
 */
export function attachAgentVmFromEnv(
  runtime: AgentVmAttachableRuntime,
  options: AttachAgentVmFromEnvOptions = {}
): AgentVmRuntimeBundle | undefined {
  const env = options.env ?? process.env;
  if (!agentVmEnabledFromEnv(env, options.enabledEnv)) return undefined;
  const barrierMode = options.barrierMode ?? agentVmBarrierModeFromEnv(env, options.barrierEnv);
  const enableStoreBuffer =
    options.enableStoreBuffer ?? env[options.storeBufferEnv ?? 'AGENT_OS_AGENT_VM_STORE_BUFFER'] === '1';
  return attachAndBindAgentVm(runtime, { ...options, barrierMode, enableStoreBuffer });
}

export function formatAgentVmBoot(
  vm: AgentVmRuntimeBundle | undefined,
  extras?: { barrierMode?: AgentVmBarrierMode }
): string {
  if (!vm) return 'Agent VM: off';
  const q = vm.coordinator.getQuarantineStore().list();
  const quarantine = Array.isArray(q) ? q.length : 0;
  const barrier = extras?.barrierMode ? ` · barrier=${extras.barrierMode}` : '';
  return `Agent VM: on${barrier} · quarantine=${quarantine}`;
}

/** Bound Agent VM plus env-derived barrier mode (status / boot helpers). */
export interface AgentVmStatus {
  enabled: true;
  vm: AgentVmRuntimeBundle;
  barrierMode: AgentVmBarrierMode;
}

export function getBoundAgentVmStatus(
  runtime: object,
  env: NodeJS.ProcessEnv = process.env,
  barrierEnv?: string
): AgentVmStatus | undefined {
  const vm = getBoundAgentVm(runtime);
  if (!vm) return undefined;
  return {
    enabled: true,
    vm,
    barrierMode: agentVmBarrierModeFromEnv(env, barrierEnv),
  };
}

/**
 * Opt-in attach + status wrapper (`AGENT_OS_AGENT_VM=1`).
 * Prefer this when callers need `enabled` + `barrierMode` alongside the VM.
 */
export function attachAgentVmStatusFromEnv(
  runtime: AgentVmAttachableRuntime,
  options: AttachAgentVmFromEnvOptions = {}
): AgentVmStatus | undefined {
  const env = options.env ?? process.env;
  const vm = attachAgentVmFromEnv(runtime, options);
  if (!vm) return undefined;
  return {
    enabled: true,
    vm,
    barrierMode: options.barrierMode ?? agentVmBarrierModeFromEnv(env, options.barrierEnv),
  };
}

export function formatAgentVmStatusBoot(status: AgentVmStatus | undefined): string {
  return formatAgentVmBoot(status?.vm, { barrierMode: status?.barrierMode });
}
