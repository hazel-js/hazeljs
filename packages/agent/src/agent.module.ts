/**
 * Agent Module
 * HazelJS module for Agent Runtime
 */

import { Injectable } from '@hazeljs/core';
import { AgentRuntime, AgentRuntimeConfig } from './runtime/agent.runtime';
import { AgentEventType } from './types/event.types';

type NewableFunction = new (...args: unknown[]) => unknown;

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

  constructor(config: AgentRuntimeConfig = {}) {
    this.runtime = new AgentRuntime(config);
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
 * Agent Module Factory
 */
export class AgentModule {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static forRoot(options: AgentModuleOptions = {}): any {
    const agentService = new AgentService(options.runtime);
    const runtime = agentService.getRuntime();

    if (options.agents) {
      for (const agentClass of options.agents) {
        runtime.registerAgent(agentClass);
      }
    }

    return {
      module: AgentModule,
      providers: [
        {
          provide: AgentService,
          useValue: agentService,
        },
        {
          provide: AgentRuntime,
          useValue: runtime,
        },
      ],
      exports: [AgentService, AgentRuntime],
    };
  }
}
