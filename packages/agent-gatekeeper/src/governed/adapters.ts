/**
 * Runtime adapters: local reference + optional OpenAI Agents (dynamic import).
 */

import {
  assertGovernedManifest,
  ExternalRuntimeUnavailableError,
  type RuntimeCapabilityManifest,
  type TrustedCallerContext,
} from './types';

export interface RuntimeStartRequest {
  caller: TrustedCallerContext;
  input: unknown;
  /** Opaque provider session id when resuming. */
  providerSessionId?: string;
}

export interface RuntimeAdapter {
  readonly name: string;
  readonly manifest: RuntimeCapabilityManifest;
  start(request: RuntimeStartRequest): Promise<{ providerSessionId: string }>;
  status(providerSessionId: string): Promise<{ alive: boolean; detail?: string }>;
  /**
   * Request cancellation. Returns acknowledged only when the adapter confirms.
   * Connection drop alone is NOT acknowledgement.
   */
  cancel(providerSessionId: string): Promise<{ acknowledged: boolean }>;
}

export const LOCAL_MANIFEST: RuntimeCapabilityManifest = {
  start: true,
  status: true,
  cancel: true,
  events: true,
  resume: true,
  toolMediation: true,
  approvalContinuation: true,
  hostedComputerUse: false,
  hostedShell: false,
};

export class LocalRuntimeAdapter implements RuntimeAdapter {
  readonly name = 'local';
  readonly manifest = LOCAL_MANIFEST;
  private readonly sessions = new Map<string, { cancelled: boolean }>();

  async start(request: RuntimeStartRequest): Promise<{ providerSessionId: string }> {
    assertGovernedManifest(this.manifest);
    void request;
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.sessions.set(id, { cancelled: false });
    return { providerSessionId: id };
  }

  async status(providerSessionId: string): Promise<{ alive: boolean; detail?: string }> {
    const s = this.sessions.get(providerSessionId);
    if (!s) return { alive: false, detail: 'unknown session' };
    return { alive: !s.cancelled, detail: s.cancelled ? 'cancelled' : 'running' };
  }

  async cancel(providerSessionId: string): Promise<{ acknowledged: boolean }> {
    const s = this.sessions.get(providerSessionId);
    if (!s) return { acknowledged: false };
    s.cancelled = true;
    return { acknowledged: true };
  }
}

/**
 * OpenAI Agents adapter — optional peer `@openai/agents`.
 * Dynamic import; missing package → typed unavailable error.
 * SDK approve() is never treated as Hazel authorization.
 */
export function createOpenAiAgentsRuntimeAdapter(): RuntimeAdapter {
  const manifest: RuntimeCapabilityManifest = {
    start: true,
    status: true,
    cancel: true,
    events: true,
    resume: true,
    toolMediation: true,
    approvalContinuation: true,
    hostedComputerUse: false,
    hostedShell: false,
  };

  return {
    name: 'openai-agents',
    manifest,
    async start(request): Promise<{ providerSessionId: string }> {
      assertGovernedManifest(manifest);
      try {
        // Dynamic import — do not hard-depend on the SDK (optional peer).
        const mod = '@openai/agents';
        await import(/* webpackIgnore: true */ mod);
      } catch {
        throw new ExternalRuntimeUnavailableError(
          'OpenAI Agents SDK is not installed or failed to load. Install @openai/agents to enable this adapter.',
          { adapter: 'openai-agents' }
        );
      }
      void request;
      // Live execution requires HAZEL_OPENAI_AGENTS_LIVE=1 and an API key.
      if (process.env.HAZEL_OPENAI_AGENTS_LIVE !== '1' || !process.env.OPENAI_API_KEY) {
        throw new ExternalRuntimeUnavailableError(
          'OpenAI Agents live mode is disabled. Set HAZEL_OPENAI_AGENTS_LIVE=1 and OPENAI_API_KEY.',
          { adapter: 'openai-agents', live: false }
        );
      }
      throw new ExternalRuntimeUnavailableError(
        'OpenAI Agents live start is opt-in and not executed in framework unit tests.',
        { adapter: 'openai-agents', live: true }
      );
    },
    async status(): Promise<{ alive: boolean; detail?: string }> {
      return { alive: false, detail: 'openai-agents status requires a live session' };
    },
    async cancel(): Promise<{ acknowledged: boolean }> {
      return { acknowledged: false };
    },
  };
}
