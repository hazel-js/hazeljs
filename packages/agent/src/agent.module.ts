/**
 * Agent Module
 * HazelJS module for Agent Runtime
 */

import { Injectable, Inject, HazelModule } from '@hazeljs/core';
import { AgentRuntime, AgentRuntimeConfig } from './runtime/agent.runtime';
import { AgentEventType } from './types/event.types';

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
@Injectable()
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
  ): Promise<unknown> {
    return this.runtime.execute(agentName, input, options);
  }

  async resume(executionId: string, input?: string): Promise<unknown> {
    return this.runtime.resume(executionId, input);
  }

  getContext(executionId: string): unknown {
    return this.runtime.getContext(executionId);
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
