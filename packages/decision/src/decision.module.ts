/**
 * DecisionModule — HazelJS DI module for the decision runtime.
 */

import { HazelModule, Service, Inject } from '@hazeljs/core';
import type { AgentRuntime, CheckpointService, HumanTaskService } from '@hazeljs/agent';
import type { AgentGatekeeper } from '@hazeljs/agent-gatekeeper';
import { DecisionRuntime, type DecisionRuntimeOptions } from './runtime/decision-runtime';
import { HazelAgentDecisionProvider } from './providers/hazel-agent-provider';
import { HazelDecisionAgent } from './agents/hazel-decision-agent';
import { getRegisteredDecisionMethods } from './decorators/decision.decorator';
import type { StructuredObjectGenerator } from './providers/structured-generator';
import type { SkillgateLookup } from './governance/authorize';
import type { DecisionRequest, DecisionResult } from './types';

export const DECISION_RUNTIME_TOKEN = 'DecisionRuntime';
export const DECISION_AUDIT_TOKEN = 'DecisionAuditService';

export interface DecisionAuditLike {
  log(event: {
    action: string;
    resource?: string;
    resourceId?: string;
    result?: string;
    metadata?: Record<string, unknown>;
    timestamp?: string;
  }): void;
}

export interface DecisionModuleOptions extends DecisionRuntimeOptions {
  /** Register HazelDecisionAgent on an existing AgentRuntime. */
  agentRuntime?: AgentRuntime;
  /** Optional @hazeljs/ai generateObject host. */
  generateObject?: StructuredObjectGenerator;
  /** Optional @hazeljs/audit AuditService-compatible logger. */
  auditService?: DecisionAuditLike;
  autoDiscoverDecisions?: boolean;
}

@Service()
export class DecisionService {
  private readonly runtime: DecisionRuntime;

  constructor(
    @Inject(DECISION_RUNTIME_TOKEN)
    runtime?: DecisionRuntime
  ) {
    this.runtime = runtime ?? new DecisionRuntime();
  }

  getRuntime(): DecisionRuntime {
    return this.runtime;
  }

  async decide<TState, const TChoices extends readonly string[]>(
    request: DecisionRequest<TState, TChoices>
  ): Promise<DecisionResult<TChoices[number]>> {
    return this.runtime.decide(request);
  }
}

@HazelModule({
  providers: [DecisionService],
  exports: [DecisionService],
})
export class DecisionModule {
  static forRoot(options: DecisionModuleOptions = {}): typeof DecisionModule {
    DecisionModule.configure(options);
    return DecisionModule;
  }

  static configure(options: DecisionModuleOptions = {}): DecisionRuntime {
    const agent = new HazelDecisionAgent();
    const hazelProvider = new HazelAgentDecisionProvider({
      generateObject: options.generateObject,
      agent,
    });

    const runtime = new DecisionRuntime({
      ...options,
      auditService: options.auditService,
    });

    // Replace default hazel-agent with configured instance.
    runtime.providers.register(hazelProvider);

    if (options.agentRuntime) {
      options.agentRuntime.registerAgent(HazelDecisionAgent);
      options.agentRuntime.registerAgentInstance('hazel-decision-agent', agent);
    }

    if (options.autoDiscoverDecisions !== false) {
      // Metadata discovery for @Decision methods (call sites still use decide()).
      void getRegisteredDecisionMethods();
    }

    DecisionModule._runtime = runtime;
    return runtime;
  }

  private static _runtime?: DecisionRuntime;

  static getRuntime(): DecisionRuntime {
    if (!DecisionModule._runtime) {
      DecisionModule._runtime = new DecisionRuntime();
    }
    return DecisionModule._runtime;
  }
}

/** Convenience: create a runtime with optional AgentRuntime registration + LLM + audit. */
export function createGovernedDecisionRuntime(
  options: DecisionModuleOptions = {}
): DecisionRuntime {
  return DecisionModule.configure(options);
}

export type { AgentGatekeeper, CheckpointService, HumanTaskService, SkillgateLookup };
