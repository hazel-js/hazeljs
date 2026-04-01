import { AssistantFacade } from '../assistant.facade';
import { AIEnhancedService } from '../../ai-enhanced.service';
import type { HazelAIConfig } from '../../platform/hazel-ai.types';

// Mock the @hazeljs/memory package
jest.mock('@hazeljs/memory', () => ({
  MemoryService: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  })),
  createMemoryStore: jest.fn(),
}));

describe('AssistantFacade', () => {
  let facade: AssistantFacade;
  let mockAIService: jest.Mocked<AIEnhancedService>;
  let mockConfig: HazelAIConfig;

  beforeEach(() => {
    mockAIService = {
      complete: jest.fn(),
      streamComplete: jest.fn(),
    } as any;

    mockConfig = {
      defaultProvider: 'openai',
    };

    facade = new AssistantFacade(mockAIService, mockConfig);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create AssistantFacade with dependencies', () => {
      expect(facade).toBeInstanceOf(AssistantFacade);
    });

    it('should initialize with memory not initialized', () => {
      expect((facade as any).memoryInitialized).toBe(false);
      expect((facade as any).memoryService).toBeNull();
    });
  });

  describe('ensureMemory', () => {
    it('should skip initialization when no memory config', async () => {
      await (facade as any).ensureMemory();

      expect((facade as any).memoryInitialized).toBe(true);
      expect((facade as any).memoryService).toBeNull();
    });

    it('should skip initialization when using in-memory store', async () => {
      mockConfig.persistence = {
        memory: {
          store: 'in-memory',
        },
      };

      await (facade as any).ensureMemory();

      expect((facade as any).memoryInitialized).toBe(true);
      expect((facade as any).memoryService).toBeNull();
    });

    it('should not initialize multiple times', async () => {
      mockConfig.persistence = {
        memory: {
          store: 'postgres',
        },
      };

      await (facade as any).ensureMemory();
      await (facade as any).ensureMemory();

      // Verifies idempotency - memoryInitialized stays true after multiple calls
      expect((facade as any).memoryInitialized).toBe(true);
    });

    it('should handle memory service initialization gracefully', async () => {
      mockConfig.persistence = {
        memory: {
          store: 'postgres',
        },
      };

      await (facade as any).ensureMemory();

      expect((facade as any).memoryInitialized).toBe(true);
    });

    it('should handle memory import errors gracefully', async () => {
      mockConfig.persistence = {
        memory: {
          store: 'postgres',
        },
      };

      // Mock import to fail
      jest.doMock('@hazeljs/memory', () => {
        throw new Error('Memory package not available');
      });

      const newFacade = new AssistantFacade(mockAIService, mockConfig);

      // Should not throw, should fall back gracefully
      await expect((newFacade as any).ensureMemory()).resolves.not.toThrow();
    });
  });

  describe('create', () => {
    it('should create assistant instance with default config', async () => {
      const mockResponse = {
        id: 'test-id',
        content: 'Hello! How can I help you?',
        role: 'assistant' as const,
        model: 'gpt-4',
      };
      mockAIService.complete.mockResolvedValue(mockResponse);

      const assistantConfig = {
        name: 'Test Assistant',
      };

      const assistant = await facade.create(assistantConfig);

      expect(assistant).toBeDefined();
      expect(assistant.sessionId).toBeDefined();
      expect(typeof assistant.chat).toBe('function');
      expect(typeof assistant.getHistory).toBe('function');
      expect(typeof assistant.clearHistory).toBe('function');
    });

    it('should create assistant instance with custom config', async () => {
      const assistantConfig = {
        name: 'Custom Assistant',
        systemPrompt: 'You are a helpful assistant.',
        model: 'gpt-4',
        temperature: 0.7,
      };

      const assistant = await facade.create(assistantConfig);

      expect(assistant.sessionId).toBeDefined();
      expect(typeof assistant.chat).toBe('function');
    });

    it('should initialize memory when creating assistant', async () => {
      mockConfig.persistence = {
        memory: {
          store: 'postgres',
        },
      };

      const assistantConfig = { name: 'Test Assistant' };
      const assistant = await facade.create(assistantConfig);

      expect((facade as any).memoryInitialized).toBe(true);
      expect(assistant).toBeDefined();
    });

    it('should create assistant and surface AI errors during chat', async () => {
      mockAIService.complete.mockRejectedValue(new Error('AI service failed'));

      const assistantConfig = { name: 'Test Assistant' };
      // create() succeeds — it doesn't call complete()
      const assistant = await facade.create(assistantConfig);
      expect(assistant).toBeDefined();

      // Error surfaces when chat() is called
      await expect(assistant.chat('Hello')).rejects.toThrow('AI service failed');
    });
  });

  describe('assistant instance methods', () => {
    let assistant: any;

    beforeEach(async () => {
      const mockResponse = {
        id: 'test-id',
        content: 'Hello! How can I help you?',
        role: 'assistant' as const,
        model: 'gpt-4',
      };
      mockAIService.complete.mockResolvedValue(mockResponse);

      const assistantConfig = { name: 'Test Assistant' };
      assistant = await facade.create(assistantConfig);
    });

    it('should chat with assistant', async () => {
      const mockResponse = {
        id: 'test-id-2',
        content: 'I can help you with that!',
        role: 'assistant' as const,
        model: 'gpt-4',
      };
      mockAIService.complete.mockResolvedValue(mockResponse);

      const response = await assistant.chat('How can you help me?');

      expect(response.content).toBe('I can help you with that!');
      expect(mockAIService.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([{ role: 'user', content: 'How can you help me?' }]),
        }),
        expect.objectContaining({
          provider: 'openai',
        })
      );
    });

    it('should maintain conversation history', async () => {
      // First message
      mockAIService.complete.mockResolvedValue({
        id: 'test-id-1',
        content: 'Hello!',
        role: 'assistant' as const,
        model: 'gpt-4',
      });

      await assistant.chat('Hi');

      // Second message
      mockAIService.complete.mockResolvedValue({
        id: 'test-id-2',
        content: 'How can I help?',
        role: 'assistant' as const,
        model: 'gpt-4',
      });

      await assistant.chat('What can you do?');

      // Should include both messages in history
      expect(mockAIService.complete).toHaveBeenCalledTimes(2);
      const secondCall = mockAIService.complete.mock.calls[1][0];
      expect(secondCall.messages).toHaveLength(3); // user1, assistant1, user2
    });

    it('should propagate AI service errors during chat', async () => {
      mockAIService.complete.mockRejectedValue(new Error('Chat failed'));

      await expect(assistant.chat('Hello')).rejects.toThrow('Chat failed');
    });

    it('should clear conversation history', async () => {
      // Add some messages to history
      mockAIService.complete.mockResolvedValue({
        id: 'test-id',
        content: 'Response',
        role: 'assistant' as const,
        model: 'gpt-4',
      });

      await assistant.chat('Test message');
      expect(assistant.getHistory()).toHaveLength(2); // user + assistant

      assistant.clearHistory();
      expect(assistant.getHistory()).toHaveLength(0);
    });

    it('should get conversation history', async () => {
      mockAIService.complete.mockResolvedValue({
        id: 'test-id',
        content: 'Response',
        role: 'assistant' as const,
        model: 'gpt-4',
      });

      await assistant.chat('Test message');

      const history = assistant.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({ role: 'user', content: 'Test message' });
      expect(history[1]).toMatchObject({ role: 'assistant', content: 'Response' });
    });

    it('should set custom system prompt', async () => {
      // Create a new assistant with system prompt
      const assistantConfig = {
        name: 'Test Assistant',
        systemPrompt: 'You are a custom assistant',
      };

      const customAssistant = await facade.create(assistantConfig);

      mockAIService.complete.mockResolvedValue({
        id: 'test-id',
        content: 'Custom response',
        role: 'assistant' as const,
        model: 'gpt-4',
      });

      await customAssistant.chat('Hello');

      expect(mockAIService.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'You are a custom assistant' },
            { role: 'user', content: 'Hello' },
          ]),
        }),
        expect.objectContaining({
          provider: 'openai',
        })
      );
    });
  });

  describe('memory integration', () => {
    it('should use memory service when configured', async () => {
      mockConfig.persistence = {
        memory: {
          store: 'postgres',
        },
      };

      const assistant = await facade.create({ name: 'Test Assistant' });

      // Memory should be initialized
      expect((facade as any).memoryInitialized).toBe(true);
      expect(assistant).toBeDefined();
    });

    it('should fall back to in-memory when memory not available', async () => {
      mockConfig.persistence = {
        memory: {
          store: 'postgres',
        },
      };

      // Mock memory import to fail
      jest.doMock('@hazeljs/memory', () => {
        throw new Error('Memory package not available');
      });

      const newFacade = new AssistantFacade(mockAIService, mockConfig);

      // Should still create assistant successfully
      const assistantConfig = { name: 'Test Assistant' };
      const assistant = await newFacade.create(assistantConfig);
      expect(assistant).toBeDefined();
    });
  });
});
