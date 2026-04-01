import { HazelModule } from '@hazeljs/core';
import { HazelAI } from './hazel-ai';
import { AIModule } from '../ai.module';
import type { HazelAIConfig } from './hazel-ai.types';

/**
 * AI Platform Module — Provides the unified HazelAI service with DI support.
 *
 * This module registers the HazelAI service and configures the underlying
 * AIModule with the provided configuration. Use forRoot() to configure
 * providers, default models, and other settings.
 */
@HazelModule({
  imports: [AIModule],
  providers: [HazelAI],
  exports: [HazelAI],
})
export class AIPlatformModule {
  private static config: HazelAIConfig = {};

  /**
   * Configure the AI Platform module.
   *
   * @param config Configuration for providers, models, and defaults
   * @returns The module type for chaining
   */
  static forRoot(config: HazelAIConfig = {}): typeof AIPlatformModule {
    AIPlatformModule.config = config;

    // Also configure the underlying AIModule
    AIModule.register({
      defaultProvider: config.defaultProvider,
      providers: config.providers
        ? (Object.keys(config.providers) as Array<keyof typeof config.providers>)
        : undefined,
      apiKeys: config.providers
        ? Object.fromEntries(Object.entries(config.providers).map(([k, v]) => [k, v?.apiKey]))
        : undefined,
    });

    return AIPlatformModule;
  }

  /**
   * Get the current configuration.
   *
   * @returns The module configuration
   */
  static getConfig(): HazelAIConfig {
    return AIPlatformModule.config;
  }
}
