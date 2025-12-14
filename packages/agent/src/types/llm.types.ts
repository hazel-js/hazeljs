/**
 * LLM Provider Types
 * Defines the interface for LLM providers used by the agent runtime
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMToolDefinition {
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

export interface LLMChatRequest {
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  model?: string;
}

export interface LLMChatResponse {
  content: string;
  tool_calls?: LLMToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

/**
 * LLM Provider Interface
 * All LLM providers must implement this interface
 */
export interface LLMProvider {
  /**
   * Send a chat completion request
   */
  chat(request: LLMChatRequest): Promise<LLMChatResponse>;

  /**
   * Optional: Check if the provider is available
   */
  isAvailable?(): Promise<boolean>;

  /**
   * Optional: Get supported models
   */
  getSupportedModels?(): string[];
}
