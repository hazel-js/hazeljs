import { HazelModule } from '@hazeljs/core';
import { AIService } from './ai.service';
import { AIEnhancedService } from './ai-enhanced.service';
import { AIProvider } from './ai-enhanced.types';

export interface AIModuleOptions {
  defaultProvider?: AIProvider;
  providers?: AIProvider[];
  apiKeys?: Partial<Record<AIProvider, string>>;
}

@HazelModule({
  providers: [AIService, AIEnhancedService],
  exports: [AIService, AIEnhancedService],
})
export class AIModule {
  private static options: AIModuleOptions = {};

  static register(options: AIModuleOptions): typeof AIModule {
    AIModule.options = options;

    // Set API keys in environment if provided (allows runtime configuration)
    if (options.apiKeys) {
      const keyMap: Record<string, string> = {
        openai: 'OPENAI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        gemini: 'GEMINI_API_KEY',
        cohere: 'COHERE_API_KEY',
      };
      for (const [provider, key] of Object.entries(options.apiKeys)) {
        if (key && keyMap[provider]) {
          process.env[keyMap[provider]] = key;
        }
      }
    }

    return AIModule;
  }

  static getOptions(): AIModuleOptions {
    return AIModule.options;
  }
}
