import { AIError } from '../errors/ai.error';
import {
  getAgentToolsFromClass,
  type AgentToolContext,
  type RegisteredAgentTool,
} from './agent-tool.decorator';
import { z } from 'zod';
import type { AIFunction } from '../ai-enhanced.types';

export class AgentToolRegistry {
  private readonly tools = new Map<string, RegisteredAgentTool>();

  registerTools(instance: object): void {
    const metas = getAgentToolsFromClass(instance.constructor);
    for (const meta of metas) {
      const method = (instance as Record<string | symbol, unknown>)[meta.methodName];
      if (typeof method !== 'function') {
        continue;
      }
      const invoke = async (input: unknown, ctx: AgentToolContext): Promise<unknown> => {
        return method.call(instance, input, ctx);
      };
      this.tools.set(meta.name, {
        name: meta.name,
        description: meta.description,
        inputSchema: meta.inputSchema,
        invoke,
      });
    }
  }

  get(name: string): RegisteredAgentTool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw AIError.toolNotFound(name);
    }
    return tool;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): RegisteredAgentTool[] {
    return [...this.tools.values()];
  }

  toAIFunctions(names: string[]): AIFunction[] {
    return names.map((name) => {
      const tool = this.get(name);
      let properties: Record<string, { type: string; description?: string; enum?: string[] }> = {};
      let required: string[] | undefined;
      if (tool.inputSchema) {
        const json = z.toJSONSchema(tool.inputSchema, { target: 'openapi-3.0' }) as {
          properties?: Record<string, { type?: string; description?: string; enum?: string[] }>;
          required?: string[];
        };
        properties = {};
        for (const [key, val] of Object.entries(json.properties ?? {})) {
          properties[key] = {
            type: val.type ?? 'string',
            description: val.description,
            enum: val.enum,
          };
        }
        required = json.required;
      }
      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties,
          required,
        },
      };
    });
  }
}
