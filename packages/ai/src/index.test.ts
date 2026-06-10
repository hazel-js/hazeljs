import {
  // AI Module
  AIModule,
  AIEnhancedService,
  AITask,
  // Fluent Chat Builder
  ChatBuilder,
  // Enhanced AI Providers
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  CohereProvider,
  OllamaProvider,
  // Decorators
  getAIFunctionMetadata,
  hasAIFunctionMetadata,
  getAIPromptMetadata,
  AIValidate,
  AIValidateProperty,
  getAIValidationMetadata,
  hasAIValidationMetadata,
  getAIPropertyValidationMetadata,
  // Vector Service
  VectorService,
  // Types
  AIProvider,
  AIModelConfig,
  AIMessageRole,
  AIMessage,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk as _AIStreamChunk,
  AIFunction as _AIFunctionType,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  IAIProvider as _IAIProvider,
  AIResponseFormat,
  AIJsonSchema,
  VectorDatabase as _VectorDatabase,
  VectorStoreConfig as _VectorStoreConfig,
  VectorDocument as _VectorDocument,
  VectorSearchRequest as _VectorSearchRequest,
  VectorSearchResult as _VectorSearchResult,
  AIContext as _AIContext,
  TokenUsage,
  TokenLimitConfig as _TokenLimitConfig,
  AIFunctionOptions as _AIFunctionOptions,
  AIValidationOptions as _AIValidationOptions,
  // Errors
  AIError,
  AIErrorCode,
  // Debug utility
  debug,
  setDebugEnabled,
  // Platform
  HazelAI,
  AIPlatformModule,
  HCELBuilder,
  HCELEngine,
} from './index';

describe('index.ts exports', () => {
  describe('AI Module exports', () => {
    it('should export AIModule', () => {
      expect(AIModule).toBeDefined();
    });

    it('should export AIEnhancedService', () => {
      expect(AIEnhancedService).toBeDefined();
    });

    it('should export AITask decorator', () => {
      expect(AITask).toBeDefined();
      expect(typeof AITask).toBe('function');
    });
  });

  describe('Chat Builder exports', () => {
    it('should export ChatBuilder', () => {
      expect(ChatBuilder).toBeDefined();
      expect(typeof ChatBuilder).toBe('function');
    });
  });

  describe('Provider exports', () => {
    it('should export OpenAIProvider', () => {
      expect(OpenAIProvider).toBeDefined();
    });

    it('should export AnthropicProvider', () => {
      expect(AnthropicProvider).toBeDefined();
    });

    it('should export GeminiProvider', () => {
      expect(GeminiProvider).toBeDefined();
    });

    it('should export CohereProvider', () => {
      expect(CohereProvider).toBeDefined();
    });

    it('should export OllamaProvider', () => {
      expect(OllamaProvider).toBeDefined();
    });
  });

  describe('Decorator function exports', () => {
    it('should export getAIFunctionMetadata', () => {
      expect(getAIFunctionMetadata).toBeDefined();
      expect(typeof getAIFunctionMetadata).toBe('function');
    });

    it('should export hasAIFunctionMetadata', () => {
      expect(hasAIFunctionMetadata).toBeDefined();
      expect(typeof hasAIFunctionMetadata).toBe('function');
    });

    it('should export getAIPromptMetadata', () => {
      expect(getAIPromptMetadata).toBeDefined();
      expect(typeof getAIPromptMetadata).toBe('function');
    });

    it('should export AIValidate decorator', () => {
      expect(AIValidate).toBeDefined();
      expect(typeof AIValidate).toBe('function');
    });

    it('should export AIValidateProperty decorator', () => {
      expect(AIValidateProperty).toBeDefined();
      expect(typeof AIValidateProperty).toBe('function');
    });

    it('should export getAIValidationMetadata', () => {
      expect(getAIValidationMetadata).toBeDefined();
      expect(typeof getAIValidationMetadata).toBe('function');
    });

    it('should export hasAIValidationMetadata', () => {
      expect(hasAIValidationMetadata).toBeDefined();
      expect(typeof hasAIValidationMetadata).toBe('function');
    });

    it('should export getAIPropertyValidationMetadata', () => {
      expect(getAIPropertyValidationMetadata).toBeDefined();
      expect(typeof getAIPropertyValidationMetadata).toBe('function');
    });
  });

  describe('Vector Service exports', () => {
    it('should export VectorService', () => {
      expect(VectorService).toBeDefined();
    });
  });

  describe('Type exports', () => {
    it('should export AIProvider type', () => {
      const provider: AIProvider = 'openai';
      expect(provider).toBe('openai');
    });

    it('should export AIModelConfig type', () => {
      const config: AIModelConfig = {
        provider: 'openai',
        model: 'gpt-4',
      };
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4');
    });

    it('should export AIMessageRole type', () => {
      const role: AIMessageRole = 'user';
      expect(role).toBe('user');
    });

    it('should export AIMessage type', () => {
      const message: AIMessage = {
        role: 'user',
        content: 'Hello',
      };
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello');
    });

    it('should export AICompletionRequest type', () => {
      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };
      expect(request.messages).toHaveLength(1);
    });

    it('should export AICompletionResponse type', () => {
      const response: AICompletionResponse = {
        id: 'test',
        content: 'Response',
        role: 'assistant',
        model: 'gpt-4',
      };
      expect(response.id).toBe('test');
      expect(response.content).toBe('Response');
    });

    it('should export AIStreamChunk type', () => {
      const chunk: _AIStreamChunk = {
        id: 'chunk1',
        content: 'Hello',
        delta: 'Hello',
        done: false,
      };
      expect(chunk.id).toBe('chunk1');
      expect(chunk.done).toBe(false);
    });

    it('should export AIFunction as type', () => {
      // Just verify the type is available - the actual type test is in other test files
      expect(true).toBe(true);
    });

    it('should export AIEmbeddingRequest type', () => {
      const request: AIEmbeddingRequest = {
        input: 'test text',
      };
      expect(request.input).toBe('test text');
    });

    it('should export AIEmbeddingResponse type', () => {
      const response: AIEmbeddingResponse = {
        embeddings: [[1, 2, 3]],
        model: 'text-embedding-ada-002',
      };
      expect(response.embeddings).toEqual([[1, 2, 3]]);
    });

    it('should export AIResponseFormat type', () => {
      const format: AIResponseFormat = 'text';
      expect(format).toBe('text');
    });

    it('should export AIJsonSchema type', () => {
      const schema: AIJsonSchema = {
        name: 'test',
        description: 'Test schema',
        schema: { type: 'object' },
      };
      expect(schema.name).toBe('test');
    });

    it('should export VectorDatabase type', () => {
      // Type-only export - verified by import
      expect(true).toBe(true);
    });

    it('should export VectorStoreConfig type', () => {
      // Type-only export - verified by import
      expect(true).toBe(true);
    });

    it('should export VectorDocument type', () => {
      // Type-only export - verified by import
      expect(true).toBe(true);
    });

    it('should export VectorSearchRequest type', () => {
      // Type-only export - verified by import
      expect(true).toBe(true);
    });

    it('should export VectorSearchResult type', () => {
      // Type-only export - verified by import
      expect(true).toBe(true);
    });

    it('should export AIContext type', () => {
      // Type-only export - verified by import
      expect(true).toBe(true);
    });

    it('should export TokenUsage type', () => {
      const usage: TokenUsage = {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        timestamp: Date.now(),
      };
      expect(usage.totalTokens).toBe(15);
    });

    it('should export TokenLimitConfig type', () => {
      // Type-only export - verified by import
      expect(true).toBe(true);
    });

    it('should export AIFunctionOptions type', () => {
      // Type-only export - verified by import
      expect(true).toBe(true);
    });

    it('should export AIValidationOptions type', () => {
      // Type-only export - verified by import
      expect(true).toBe(true);
    });
  });

  describe('Error exports', () => {
    it('should export AIError class', () => {
      expect(AIError).toBeDefined();
      expect(typeof AIError).toBe('function');

      const error = new AIError('Test error', 'UNKNOWN_ERROR' as AIErrorCode);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AIError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('UNKNOWN_ERROR');
    });

    it('should export AIErrorCode enum', () => {
      expect(AIErrorCode).toBeDefined();
      expect(typeof AIErrorCode).toBe('object');
    });
  });

  describe('Debug utility exports', () => {
    it('should export debug function', () => {
      expect(debug).toBeDefined();
      expect(typeof debug).toBe('function');
    });

    it('should export setDebugEnabled function', () => {
      expect(setDebugEnabled).toBeDefined();
      expect(typeof setDebugEnabled).toBe('function');
    });
  });

  describe('Platform exports', () => {
    it('should export HazelAI', () => {
      expect(HazelAI).toBeDefined();
    });

    it('should export AIPlatformModule', () => {
      expect(AIPlatformModule).toBeDefined();
    });

    it('should export HCELBuilder', () => {
      expect(HCELBuilder).toBeDefined();
    });

    it('should export HCELEngine', () => {
      expect(HCELEngine).toBeDefined();
    });
  });

  describe('Interface exports', () => {
    it('should export IAIProvider interface', () => {
      // Interface-only export - verified by import
      expect(true).toBe(true);
    });
  });
});
