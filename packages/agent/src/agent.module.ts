/**
 * Agent Module
 * HazelJS module for Agent Runtime
 */

import { Service, Inject, HazelModule } from '@hazeljs/core';
import { AgentRuntime, AgentRuntimeConfig } from './runtime/agent.runtime';
import { AgentEventType } from './types/event.types';
import type { AgentContext, AgentExecutionResult, AgentStreamChunk } from './types/agent.types';

type NewableFunction = new (...args: unknown[]) => unknown;

/** Token for optional GuardrailsService injection (from @hazeljs/guardrails) */
export const GUARDRAILS_SERVICE_TOKEN = 'GuardrailsService';

/**
 * Agent Module Options
 */
export interface AgentModuleOptions {
  runtime?: AgentRuntimeConfig;
  agents?: NewableFunction[];
}

/**
 * Agent Service
 * Injectable service for agent runtime
 */
@Service()
export class AgentService {
  private runtime: AgentRuntime;

  constructor(
    @Inject(GUARDRAILS_SERVICE_TOKEN)
    guardrailsService?: {
      checkInput: (
        input: string | object,
        options?: unknown
      ) => {
        allowed: boolean;
        modified?: string | object;
        violations?: string[];
        blockedReason?: string;
      };
      checkOutput: (
        output: string | object,
        options?: unknown
      ) => {
        allowed: boolean;
        modified?: string | object;
        violations?: string[];
        blockedReason?: string;
      };
    },
    config: AgentRuntimeConfig = {}
  ) {
    const moduleOpts = AgentModule.getOptions();
    const runtimeConfig: AgentRuntimeConfig = {
      ...(moduleOpts.runtime || config),
      guardrailsService:
        guardrailsService ?? moduleOpts.runtime?.guardrailsService ?? config.guardrailsService,
    };
    this.runtime = new AgentRuntime(runtimeConfig);

    // Register agents from module options
    if (moduleOpts.agents) {
      for (const agentClass of moduleOpts.agents) {
        this.runtime.registerAgent(agentClass);
      }
    }
  }

  getRuntime(): AgentRuntime {
    return this.runtime;
  }

  async execute(
    agentName: string,
    input: string,
    options?: Record<string, unknown>
  ): Promise<AgentExecutionResult> {
    return this.runtime.execute(
      agentName,
      input,
      options as Parameters<AgentRuntime['execute']>[2]
    );
  }

  async resume(executionId: string, input?: string): Promise<AgentExecutionResult> {
    return this.runtime.resume(executionId, input);
  }

  async getContext(executionId: string): Promise<AgentContext | undefined> {
    return this.runtime.getContext(executionId);
  }

  /**
   * Execute with streaming; yields step and token chunks when LLM supports streamChat.
   */
  async *executeStream(
    agentName: string,
    input: string,
    options?: Record<string, unknown>
  ): AsyncGenerator<AgentStreamChunk> {
    yield* this.runtime.executeStream(
      agentName,
      input,
      options as Parameters<AgentRuntime['executeStream']>[2]
    );
  }

  /**
   * Cancel an in-flight execution by executionId.
   */
  cancel(executionId: string): void {
    this.runtime.cancel(executionId);
  }

  on(type: AgentEventType, handler: (event: unknown) => void): void {
    return this.runtime.on(type, handler);
  }

  getAgents(): unknown[] {
    return this.runtime.getAgents();
  }

  approveToolExecution(requestId: string, approvedBy: string): void {
    return this.runtime.approveToolExecution(requestId, approvedBy);
  }

  rejectToolExecution(requestId: string): void {
    return this.runtime.rejectToolExecution(requestId);
  }

  getPendingApprovals(): unknown[] {
    return this.runtime.getPendingApprovals();
  }
}

/**
 * Agent Module
 * Uses static configuration pattern compatible with HazelJS DI
 */
@HazelModule({
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {
  private static options: AgentModuleOptions = {};

  static forRoot(options: AgentModuleOptions = {}): typeof AgentModule {
    AgentModule.options = options;
    return AgentModule;
  }

  static getOptions(): AgentModuleOptions {
    return AgentModule.options;
  }
}
