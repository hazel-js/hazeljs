import { AIModule } from './ai.module';
import { AIEnhancedService } from './ai-enhanced.service';
import { HazelApp } from '@hazeljs/core';
import { AIProvider } from './ai-enhanced.types';

describe('AIModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Reset module options
    (AIModule as any).options = {};
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(AIModule).toBeDefined();
  });

  it('should provide AIEnhancedService', () => {
    const app = new HazelApp(AIModule);
    const container = app.getContainer();
    const enhancedService = container.resolve(AIEnhancedService);
    expect(enhancedService).toBeInstanceOf(AIEnhancedService);
  });

  it('should provide AIEnhancedService as singleton', () => {
    const app = new HazelApp(AIModule);
    const container = app.getContainer();
    const service1 = container.resolve(AIEnhancedService);
    const service2 = container.resolve(AIEnhancedService);
    expect(service1).toBe(service2);
  });

  describe('register', () => {
    it('should register options and return AIModule', () => {
      const options = {
        defaultProvider: 'openai' as AIProvider,
        providers: ['openai', 'anthropic'] as AIProvider[],
        apiKeys: {
          openai: 'test-key',
          anthropic: 'test-key-2',
        },
      };

      const result = AIModule.register(options);

      expect(result).toBe(AIModule);
      expect(AIModule.getOptions()).toEqual(options);
    });

    it('should set environment variables for API keys', () => {
      const options = {
        apiKeys: {
          openai: 'openai-test-key',
          anthropic: 'anthropic-test-key',
          gemini: 'gemini-test-key',
          cohere: 'cohere-test-key',
        },
      };

      AIModule.register(options);

      expect(process.env.OPENAI_API_KEY).toBe('openai-test-key');
      expect(process.env.ANTHROPIC_API_KEY).toBe('anthropic-test-key');
      expect(process.env.GEMINI_API_KEY).toBe('gemini-test-key');
      expect(process.env.COHERE_API_KEY).toBe('cohere-test-key');
    });

    it('should not set environment variables for undefined API keys', () => {
      const options = {
        apiKeys: {
          openai: 'test-key',
          anthropic: undefined,
        },
      };

      AIModule.register(options);

      expect(process.env.OPENAI_API_KEY).toBe('test-key');
      expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
    });

    it('should handle empty options', () => {
      const options = {};

      AIModule.register(options);

      expect(AIModule.getOptions()).toEqual({});
    });

    it('should handle options without API keys', () => {
      const options = {
        defaultProvider: 'openai' as AIProvider,
        providers: ['openai'] as AIProvider[],
      };

      AIModule.register(options);

      expect(AIModule.getOptions()).toEqual(options);
      expect(process.env.OPENAI_API_KEY).toBeUndefined();
    });

    it('should handle unknown providers gracefully', () => {
      const options = {
        apiKeys: {
          ollama: 'unknown-key',
        },
      };

      AIModule.register(options);

      expect(process.env.OLLAMA_API_KEY).toBeUndefined();
    });

    it('should override existing environment variables', () => {
      process.env.OPENAI_API_KEY = 'existing-key';

      const options = {
        apiKeys: {
          openai: 'new-key',
        },
      };

      AIModule.register(options);

      expect(process.env.OPENAI_API_KEY).toBe('new-key');
    });
  });

  describe('getOptions', () => {
    it('should return empty options initially', () => {
      const options = AIModule.getOptions();
      expect(options).toEqual({});
    });

    it('should return registered options', () => {
      const options = {
        defaultProvider: 'anthropic' as AIProvider,
        providers: ['anthropic', 'gemini'] as AIProvider[],
      };

      AIModule.register(options);
      const retrievedOptions = AIModule.getOptions();

      expect(retrievedOptions).toEqual(options);
    });

    it('should return the same options reference', () => {
      const options = { defaultProvider: 'openai' as AIProvider };

      AIModule.register(options);
      const retrieved1 = AIModule.getOptions();
      const retrieved2 = AIModule.getOptions();

      expect(retrieved1).toBe(retrieved2);
    });
  });

  describe('module configuration', () => {
    it('should have correct providers and exports configuration', () => {
      // Test that the module is properly decorated with @HazelModule
      expect(AIModule).toBeDefined();

      // Test that the module provides the expected services
      const app = new HazelApp(AIModule);
      const container = app.getContainer();

      expect(() => container.resolve(AIEnhancedService)).not.toThrow();
      expect(() => container.resolve(AIEnhancedService)).not.toThrow();
    });
  });
});
