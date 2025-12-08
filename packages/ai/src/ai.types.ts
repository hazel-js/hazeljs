export type LLMProvider = 'openai' | 'ollama' | 'anthropic' | 'custom';

export interface AITaskConfig {
  name: string;
  prompt: string;
  provider: LLMProvider;
  model: string;
  outputType: 'string' | 'json' | 'number' | 'boolean';
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  customProvider?: {
    url: string;
    headers?: Record<string, string>;
    transformRequest?: (input: unknown) => unknown;
    transformResponse?: (response: unknown) => unknown;
  };
}

export interface AITaskContext {
  taskName: string;
  description: string;
  inputExample: string;
  outputExample: string;
  input: unknown;
}

export interface AITaskResult<T = unknown> {
  data?: T;
  error?: string;
  stream?: AsyncIterable<string>;
}
