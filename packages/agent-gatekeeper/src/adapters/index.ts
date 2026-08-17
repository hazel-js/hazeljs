/**
 * Tool adapters — function, HazelJS, Skillgate, MCP.
 */

import { z } from 'zod';
import type {
  ProtectedTool,
  ToolClassification,
  ToolExecutorGateInput,
  ToolExecutorGateResult,
  ToolInvocationContext,
  ToolRiskLevel,
} from '../types';
import type { AgentGatekeeper } from '../gatekeeper';
import { defaultClock, defaultIdGenerator } from '../security';
import { GatekeeperApprovalRequiredError } from '../errors';

export function fromFunction<TInput, TOutput>(
  name: string,
  fn: (input: TInput) => Promise<TOutput> | TOutput,
  meta: {
    classification?: ToolClassification;
    riskLevel?: ToolRiskLevel;
    inputSchema?: z.ZodType<TInput>;
    outputSchema?: z.ZodType<TOutput>;
    redactFields?: string[];
    estimatedCostUnits?: number;
    version?: string;
    description?: string;
  } = {}
): ProtectedTool<TInput, TOutput> {
  return {
    name,
    version: meta.version,
    description: meta.description,
    inputSchema: meta.inputSchema,
    outputSchema: meta.outputSchema,
    classification: meta.classification ?? 'read',
    riskLevel: meta.riskLevel ?? 'low',
    readOnly: meta.classification === 'read',
    redactFields: meta.redactFields,
    estimatedCostUnits: meta.estimatedCostUnits,
    execute: async (input) => fn(input),
  };
}

/** Adapt a HazelJS ToolMetadata-like object (optional @hazeljs/agent peer). */
export function fromHazelTool<TInput = Record<string, unknown>, TOutput = unknown>(tool: {
  name: string;
  description?: string;
  schema?: z.ZodType<TInput>;
  requiresApproval?: boolean;
  riskLevel?: ToolRiskLevel;
  readOnly?: boolean;
  capability?: string;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  method: Function;
  target: object;
}): ProtectedTool<TInput, TOutput> {
  const classification: ToolClassification = tool.readOnly
    ? 'read'
    : tool.riskLevel === 'critical' || tool.riskLevel === 'high'
      ? 'destructive'
      : 'write';
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.schema,
    classification,
    riskLevel: tool.riskLevel ?? (tool.readOnly ? 'low' : 'medium'),
    readOnly: tool.readOnly,
    execute: async (input) => tool.method.call(tool.target, input) as Promise<TOutput>,
  };
}

/** Adapt a Skillgate GovernedSkill + invoker (optional @hazeljs/skillgate peer). */
export function fromSkillgate<TInput = Record<string, unknown>, TOutput = unknown>(
  skill: {
    name: string;
    description: string;
    class: 'read' | 'write' | 'destructive' | 'admin';
    readOnly: boolean;
    requiresApproval: boolean;
    method?: string;
    path?: string;
  },
  invoker: (input: TInput) => Promise<TOutput>
): ProtectedTool<TInput, TOutput> {
  const classMap: Record<string, ToolClassification> = {
    read: 'read',
    write: 'write',
    destructive: 'destructive',
    admin: 'destructive',
  };
  return {
    name: skill.name,
    description: skill.description,
    classification: classMap[skill.class] ?? 'write',
    riskLevel: skill.class === 'destructive' || skill.class === 'admin' ? 'critical' : 'medium',
    readOnly: skill.readOnly,
    execute: async (input) => invoker(input),
  };
}

/** Wrap MCP tool descriptor + call for application-level authorization. */
export function fromMcpTool<TInput = Record<string, unknown>, TOutput = unknown>(
  descriptor: { name: string; description?: string },
  callTool: (name: string, input: TInput) => Promise<TOutput>,
  meta: {
    classification?: ToolClassification;
    riskLevel?: ToolRiskLevel;
    inputSchema?: z.ZodType<TInput>;
    outputSchema?: z.ZodType<TOutput>;
  } = {}
): ProtectedTool<TInput, TOutput> {
  return {
    name: descriptor.name,
    description: descriptor.description,
    inputSchema: meta.inputSchema,
    outputSchema: meta.outputSchema,
    classification: meta.classification ?? 'write',
    riskLevel: meta.riskLevel ?? 'medium',
    execute: async (input) => callTool(descriptor.name, input),
  };
}

export interface ToolExecutorContextFactory {
  (input: ToolExecutorGateInput): ToolInvocationContext;
}

export function createToolExecutorGate(
  gatekeeper: AgentGatekeeper,
  contextFactory?: ToolExecutorContextFactory
): {
  execute(input: ToolExecutorGateInput): Promise<ToolExecutorGateResult>;
} {
  const defaultFactory: ToolExecutorContextFactory = (input) => ({
    invocationId: defaultIdGenerator()(),
    runId: input.runId ?? `run-${input.sessionId}`,
    agentId: input.agentId,
    agentVersion: input.agentVersion,
    tenantId: input.tenantId,
    delegatedUserId: input.userId,
    sessionId: input.sessionId,
    toolName: input.tool.name,
    input: input.input,
    environment: input.environment ?? 'development',
    timestamp: defaultClock().now(),
    capabilities: input.capabilities,
  });

  const factory = contextFactory ?? defaultFactory;

  return {
    async execute(input: ToolExecutorGateInput): Promise<ToolExecutorGateResult> {
      const start = Date.now();
      const context = factory(input);
      const tool = fromHazelTool(input.tool);

      try {
        const result = await gatekeeper.execute({ context, tool });
        return {
          success: true,
          output: result.output,
          duration: Date.now() - start,
        };
      } catch (err) {
        if (err instanceof GatekeeperApprovalRequiredError) {
          return {
            success: false,
            pendingApproval: true,
            requestId: err.approvalRequestId,
            duration: Date.now() - start,
            metadata: {
              toolName: input.tool.name,
              input: input.input,
              runId: input.runId,
            },
          };
        }
        return {
          success: false,
          error: err instanceof Error ? err : new Error(String(err)),
          duration: Date.now() - start,
        };
      }
    },
  };
}

/** Opt-in wrapper for MCP invoke — does not change default HazelToolAdapter behavior. */
export function protectMcpInvoke<TInput extends Record<string, unknown>, TOutput>(
  invoke: (toolName: string, input: TInput) => Promise<TOutput>,
  gatekeeper: AgentGatekeeper,
  contextFactory: (toolName: string, input: TInput) => ToolInvocationContext<TInput>,
  meta?: (toolName: string) => Partial<ProtectedTool<TInput, TOutput>>
): (toolName: string, input: TInput) => Promise<TOutput> {
  return async (toolName, input) => {
    const context = contextFactory(toolName, input);
    const tool = fromMcpTool(
      { name: toolName },
      (n, i) => invoke(n, i as TInput),
      meta?.(toolName)
    );
    const result = await gatekeeper.execute<TInput, TOutput>({
      context,
      tool,
    });
    return result.output as TOutput;
  };
}
