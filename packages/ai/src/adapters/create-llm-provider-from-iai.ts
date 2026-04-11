/**
 * Bridge {@link IAIProvider} to the shape expected by @hazeljs/agent `LLMProvider`.
 * Structural typing only (no import from agent) so @hazeljs/ai builds independently.
 */
import type { IAIProvider, AIFunction, AIMessage } from '../ai-enhanced.types';

/** Mirrors @hazeljs/agent LLMToolDefinition / LLMChatRequest subset used by the bridge. */
interface BridgeTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

interface BridgeChatRequest {
  messages: Array<{ role: string; content: string; name?: string }>;
  tools?: BridgeTool[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

interface BridgeToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface BridgeChatResponse {
  content: string;
  tool_calls?: BridgeToolCall[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason?: string;
}

type BridgeStreamChunk = {
  content?: string;
  done?: boolean;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
};

/** Return type is assignable to @hazeljs/agent `LLMProvider` at runtime. */
export type AgentCompatibleLLMProvider = {
  chat(request: BridgeChatRequest): Promise<BridgeChatResponse>;
  streamChat?(request: BridgeChatRequest): AsyncIterable<BridgeStreamChunk>;
  isAvailable?(): Promise<boolean>;
};

function mapToolsToFunctions(tools: BridgeTool[]): AIFunction[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: {
      type: 'object' as const,
      properties: t.function.parameters.properties as Record<
        string,
        { type: string; description?: string; enum?: string[] }
      >,
      required: t.function.parameters.required,
    },
  }));
}

/**
 * Wrap an {@link IAIProvider} for use with `AgentRuntime` / `AgentExecutor` (pass result as `llmProvider`).
 */
export function createLLMProviderFromIAI(
  iai: IAIProvider,
  defaultModel?: string
): AgentCompatibleLLMProvider {
  return {
    async chat(request: BridgeChatRequest): Promise<BridgeChatResponse> {
      const msgs: AIMessage[] = request.messages.map((m) => ({
        role: m.role as AIMessage['role'],
        content: m.content,
        name: m.name,
      }));

      const hasToolResultsInHistory = msgs.some(
        (m) =>
          m.role === 'assistant' && typeof m.content === 'string' && m.content.startsWith('[Tool:')
      );

      const functions =
        !hasToolResultsInHistory && request.tools && request.tools.length > 0
          ? mapToolsToFunctions(request.tools)
          : undefined;

      const response = await iai.complete({
        messages: msgs,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        model: request.model ?? defaultModel,
        ...(functions?.length ? { functions, functionCall: 'auto' as const } : {}),
      });

      let tool_calls: BridgeToolCall[] | undefined;
      if (response.toolCalls && response.toolCalls.length > 0) {
        tool_calls = response.toolCalls.map((tc) => ({
          ...tc,
          type: 'function' as const,
        }));
      } else if (response.functionCall) {
        tool_calls = [
          {
            id: `call_${Date.now()}`,
            type: 'function' as const,
            function: {
              name: response.functionCall.name,
              arguments: response.functionCall.arguments,
            },
          },
        ];
      }

      return {
        content: response.content || '',
        tool_calls,
        usage: response.usage,
        finishReason: response.finishReason,
      };
    },

    async *streamChat(
      request: BridgeChatRequest
    ): AsyncGenerator<BridgeStreamChunk, void, undefined> {
      const msgs: AIMessage[] = request.messages.map((m) => ({
        role: m.role as AIMessage['role'],
        content: m.content,
        name: m.name,
      }));

      const functions =
        request.tools && request.tools.length > 0 ? mapToolsToFunctions(request.tools) : undefined;

      for await (const chunk of iai.streamComplete({
        messages: msgs,
        model: request.model ?? defaultModel,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        ...(functions?.length ? { functions, functionCall: 'auto' as const } : {}),
      })) {
        yield {
          content: chunk.delta,
          done: chunk.done,
          usage: chunk.usage,
        };
      }
    },

    isAvailable: () => iai.isAvailable(),
  };
}
