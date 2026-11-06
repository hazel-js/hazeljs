import 'reflect-metadata';
import type { z } from 'zod';

const AGENT_TOOL_KEY = 'hazel:ai:agent-tool';
const AGENT_TOOLS_CLASS_KEY = 'hazel:ai:agent-tools';

export interface AgentToolOptions {
  name?: string;
  description: string;
  inputSchema?: z.ZodTypeAny;
}

export interface AgentToolMetadata extends AgentToolOptions {
  methodName: string | symbol;
  name: string;
}

/**
 * Marks a method as a tool the model may call (distinct from @AIFunction, which calls the model).
 */
export function AgentTool(options: AgentToolOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const name = options.name ?? String(propertyKey);
    const meta: AgentToolMetadata = {
      ...options,
      name,
      methodName: propertyKey,
    };
    Reflect.defineMetadata(AGENT_TOOL_KEY, meta, target, propertyKey);
    const existing: AgentToolMetadata[] =
      Reflect.getMetadata(AGENT_TOOLS_CLASS_KEY, target.constructor) ?? [];
    existing.push(meta);
    Reflect.defineMetadata(AGENT_TOOLS_CLASS_KEY, existing, target.constructor);
    return descriptor;
  };
}

export function getAgentToolMetadata(
  target: object,
  propertyKey: string | symbol
): AgentToolMetadata | undefined {
  return Reflect.getMetadata(AGENT_TOOL_KEY, target, propertyKey);
}

export function getAgentToolsFromClass(ctor: object): AgentToolMetadata[] {
  return Reflect.getMetadata(AGENT_TOOLS_CLASS_KEY, ctor) ?? [];
}

export interface AgentToolCaller {
  request?: unknown;
  user?: { id?: string; [key: string]: unknown };
  scopes?: string[];
}

export interface AgentToolContext {
  name: string;
  toolCallId: string;
  signal?: AbortSignal;
  caller?: AgentToolCaller;
  idempotencyKey?: string;
  messages?: unknown[];
  reportProgress: (progress: number, total?: number, message?: string) => void | Promise<void>;
}

export interface RegisteredAgentTool {
  name: string;
  description: string;
  inputSchema?: z.ZodTypeAny;
  invoke: (input: unknown, ctx: AgentToolContext) => Promise<unknown>;
}
