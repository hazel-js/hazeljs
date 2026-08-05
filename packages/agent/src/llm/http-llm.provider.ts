/**
 * Minimal OpenAI-compatible chat provider (CLI / bootstrap).
 * Uses fetch — no SDK dependency.
 */

import type { LLMChatRequest, LLMChatResponse, LLMProvider, LLMToolCall } from '../types/llm.types';

export interface HttpLlmProviderOptions {
  apiKey: string;
  /** e.g. https://api.openai.com/v1 */
  baseUrl?: string;
  model?: string;
  /** Optional fetch override (tests). */
  fetchImpl?: typeof fetch;
}

/**
 * OpenAI Chat Completions-compatible provider.
 */
export function createHttpLlmProvider(options: HttpLlmProviderOptions): LLMProvider {
  const baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = options.model ?? 'gpt-4o-mini';
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
      const body: Record<string, unknown> = {
        model: request.model ?? model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      };
      if (request.tools?.length) {
        body.tools = request.tools;
        body.tool_choice = 'auto';
      }

      const res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 500)}`);
      }
      const json = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              type: string;
              function: { name: string; arguments: string };
            }>;
          };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const msg = json.choices?.[0]?.message;
      const tool_calls: LLMToolCall[] | undefined = msg?.tool_calls?.map((t) => ({
        id: t.id,
        type: 'function' as const,
        function: t.function,
      }));
      return {
        content: msg?.content ?? '',
        tool_calls,
        finishReason: json.choices?.[0]?.finish_reason,
        usage: json.usage
          ? {
              promptTokens: json.usage.prompt_tokens ?? 0,
              completionTokens: json.usage.completion_tokens ?? 0,
              totalTokens: json.usage.total_tokens ?? 0,
            }
          : undefined,
      };
    },
  };
}

/** Offline smoke provider — always returns a short text answer (no tool calls). */
export function createMockLlmProvider(reply = 'OK'): LLMProvider {
  return {
    async chat(): Promise<LLMChatResponse> {
      return { content: reply, finishReason: 'stop' };
    },
  };
}
