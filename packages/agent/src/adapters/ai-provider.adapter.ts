/**
 * Adapter to use @hazeljs/ai providers with the Agent Runtime.
 * Enables AI, agent, and RAG packages to work together seamlessly.
 *
 * Usage:
 *   import { AIEnhancedService } from '@hazeljs/ai';
 *   import { AgentRuntime, createLLMProviderFromAI } from '@hazeljs/agent';
 *
 *   const aiService = new AIEnhancedService();
 *   const llmProvider = createLLMProviderFromAI(aiService, { model: 'gpt-4' });
 *   const runtime = new AgentRuntime({ llmProvider, ... });
 */

import type { LLMProvider, LLMChatRequest, LLMChatResponse } from '../types/llm.types';

/**
 * Minimal interface for AI completion services.
 * Satisfied by @hazeljs/ai AIEnhancedService when installed.
 */
export interface AIServiceAdapter {
  complete(request: {
    messages: Array<{ role: string; content: string; name?: string }>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    functions?: Array<{
      name: string;
      description: string;
      parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
    }>;
    functionCall?: 'auto' | 'none' | { name: string };
  }): Promise<{
    content: string;
    functionCall?: { name: string; arguments: string };
    toolCalls?: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }>;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    finishReason?: string;
  }>;
}

export interface CreateLLMProviderFromAIOptions {
  /** Default model when request does not specify one */
  model?: string;
  /** Default AI provider (openai, anthropic, etc.) for AIEnhancedService */
  provider?: string;
}

/**
 * Create an LLMProvider for AgentRuntime from an AI service (e.g. AIEnhancedService).
 */
export function createLLMProviderFromAI(
  aiService: AIServiceAdapter,
  options?: CreateLLMProviderFromAIOptions
): LLMProvider {
  return {
    async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
      const functions = request.tools?.map((t) => t.function);

      const response = await aiService.complete({
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
          name: m.name,
        })),
        model: request.model ?? options?.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        topP: request.topP,
        functions:
          functions && functions.length > 0
            ? functions.map((f) => ({
                name: f.name,
                description: f.description,
                parameters: f.parameters,
              }))
            : undefined,
        functionCall: functions && functions.length > 0 ? 'auto' : undefined,
      });

      const tool_calls =
        response.toolCalls?.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: tc.function,
        })) ??
        (response.functionCall
          ? [
              {
                id: `call_${Date.now()}`,
                type: 'function' as const,
                function: {
                  name: response.functionCall.name,
                  arguments: response.functionCall.arguments,
                },
              },
            ]
          : undefined);

      return {
        content: response.content ?? '',
        tool_calls,
        usage: response.usage,
        finishReason: response.finishReason,
      };
    },
  };
}
