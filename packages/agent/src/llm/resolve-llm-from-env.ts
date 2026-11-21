/**
 * Pick HTTP OpenAI-compatible LLM when OPENAI_API_KEY is set; otherwise mock.
 */

import type { LLMProvider } from '../types/llm.types';
import { createHttpLlmProvider, createMockLlmProvider } from './http-llm.provider';

export interface ResolveLlmFromEnvOptions {
  /** Explicit provider wins over env. */
  llmProvider?: LLMProvider;
  /** Mock reply when no API key. */
  mockReply?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Resolve LLM for AgentOS / hazeld / scaffolds.
 * - explicit `llmProvider` → use as-is
 * - `OPENAI_API_KEY` → createHttpLlmProvider (model: HAZEL_AGENT_MODEL, baseUrl: OPENAI_BASE_URL)
 * - else → createMockLlmProvider
 */
export function resolveLlmFromEnv(options: ResolveLlmFromEnvOptions = {}): LLMProvider {
  if (options.llmProvider) return options.llmProvider;
  const env = options.env ?? process.env;
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    return createHttpLlmProvider({
      apiKey,
      model: env.HAZEL_AGENT_MODEL?.trim() || 'gpt-4o-mini',
      baseUrl: env.OPENAI_BASE_URL?.trim() || undefined,
    });
  }
  return createMockLlmProvider(
    options.mockReply ??
      'No OPENAI_API_KEY — using mock LLM. Set OPENAI_API_KEY in .env for real tool selection.'
  );
}
