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

/**
 * Resolve AIEnhancedService from the Hazel DI container when aiDiagnostics: true.
 */
export function resolveGlobalHazelAIDiagnosticsProvider(
  options: { model?: string; provider?: string } = {}
): AIDiagnosticsProvider | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Container } = require('@hazeljs/core') as {
      Container: {
        getInstance: () => {
          has: (token: unknown) => boolean;
          resolve: (token: unknown) => HazelAICompletionClient;
        };
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AIEnhancedService } = require('@hazeljs/ai') as {
      AIEnhancedService: new (...args: unknown[]) => HazelAICompletionClient;
    };
    const container = Container.getInstance();
    if (!container.has(AIEnhancedService)) {
      return undefined;
    }
    const aiService = container.resolve(AIEnhancedService);
    if (!aiService?.complete) {
      return undefined;
    }
    return createHazelAIDiagnosticsProvider(aiService, options);
  } catch {
    return undefined;
  }
}
