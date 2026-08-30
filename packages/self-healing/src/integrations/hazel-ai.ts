import { createAIDiagnosticsProvider } from '../diagnosis/ai-diagnostics-provider';
import { AIDiagnosticsProvider } from '../types';

export interface HazelAICompletionClient {
  complete(
    request: {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      model?: string;
      temperature?: number;
    },
    config?: { provider?: string }
  ): Promise<{ content: string }>;
}

/**
 * Bridge @hazeljs/ai AIEnhancedService to self-healing diagnostics.
 */
export function createHazelAIDiagnosticsProvider(
  aiService: HazelAICompletionClient,
  options: { model?: string; provider?: string } = {}
): AIDiagnosticsProvider {
  return createAIDiagnosticsProvider(
    {
      complete: async (messages, completeOptions) => {
        const response = await aiService.complete(
          {
            messages,
            model: completeOptions?.model ?? options.model,
            temperature: completeOptions?.temperature,
          },
          options.provider ? { provider: options.provider } : undefined
        );
        return response.content;
      },
    },
    { model: options.model }
  );
}

type GlobalWithHazelAI = typeof globalThis & {
  __HAZELJS_AI_ENHANCED_SERVICE__?: HazelAICompletionClient;
};

/**
 * Resolve AIEnhancedService from HazelJS global when aiDiagnostics: true.
 */
export function resolveGlobalHazelAIDiagnosticsProvider(
  options: { model?: string; provider?: string } = {}
): AIDiagnosticsProvider | undefined {
  const aiService = (global as GlobalWithHazelAI).__HAZELJS_AI_ENHANCED_SERVICE__;
  if (!aiService) {
    return undefined;
  }
  return createHazelAIDiagnosticsProvider(aiService, options);
}
