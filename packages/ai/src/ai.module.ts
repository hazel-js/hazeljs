import { HazelModule } from '@hazeljs/core';
import { AIEnhancedService } from './ai-enhanced.service';
import {
  getAIModuleOptions,
  hasNamedModels,
  listModelNames,
  resolveNamedModel,
  setAIModuleOptions,
  validateNamedModels,
  type AIModuleOptions,
} from './models/module-options';

export type { AIModuleOptions };

@HazelModule({
  providers: [AIEnhancedService],
  exports: [AIEnhancedService],
})
export class AIModule {
  static register(options: AIModuleOptions): typeof AIModule {
    setAIModuleOptions(options);

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

    if (options.models) {
      validateNamedModels(options.models);
    }

    return AIModule;
  }

  static getOptions(): AIModuleOptions {
    return getAIModuleOptions();
  }

  static validateModels(models: NonNullable<AIModuleOptions['models']>): void {
    validateNamedModels(models);
  }

  static resolveNamedModel(name: string): ReturnType<typeof resolveNamedModel> {
    return resolveNamedModel(name);
  }

  static hasNamedModels(): boolean {
    return hasNamedModels();
  }

  static listModelNames(): string[] {
    return listModelNames();
  }
}
