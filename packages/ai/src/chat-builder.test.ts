import { ChatBuilder, ChatBuilderHost } from './chat-builder';
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  AIFunction,
} from './ai-enhanced.types';

describe('ChatBuilder', () => {
  let mockHost: jest.Mocked<ChatBuilderHost>;
  let chatBuilder: ChatBuilder;

  beforeEach(() => {
    mockHost = {
      complete: jest.fn(),
      streamComplete: jest.fn(),
    };
    chatBuilder = new ChatBuilder(mockHost, 'Hello, world!');
  });

  describe('constructor', () => {
    it('should initialize with user message', () => {
      const builder = new ChatBuilder(mockHost, 'Test message');
      expect(builder).toBeInstanceOf(ChatBuilder);
    });
  });

  describe('message building methods', () => {
    it('should add system message', () => {
      const result = chatBuilder.system('You are a helpful assistant');
      expect(result).toBe(chatBuilder); // Should return this for chaining
    });

    it('should add additional user message', () => {
      const result = chatBuilder.user('Another user message');
      expect(result).toBe(chatBuilder);
    });

    it('should add assistant message', () => {
      const result = chatBuilder.assistant('Assistant response');
      expect(result).toBe(chatBuilder);
    });
  });

  describe('configuration methods', () => {
    it('should set model', () => {
      const result = chatBuilder.model('gpt-4');
      expect(result).toBe(chatBuilder);
    });

    it('should set temperature', () => {
      const result = chatBuilder.temperature(0.7);
      expect(result).toBe(chatBuilder);
    });

    it('should set max tokens', () => {
      const result = chatBuilder.maxTokens(500);
      expect(result).toBe(chatBuilder);
    });

    it('should set top-p', () => {
      const result = chatBuilder.topP(0.9);
      expect(result).toBe(chatBuilder);
    });

    it('should set provider', () => {
      const result = chatBuilder.provider('openai' as AIProvider);
      expect(result).toBe(chatBuilder);
    });

    it('should set user ID', () => {
      const result = chatBuilder.userId('user123');
      expect(result).toBe(chatBuilder);
    });

    it('should set cache configuration', () => {
      const result = chatBuilder.cache('cache-key', 3600);
      expect(result).toBe(chatBuilder);
    });

    it('should set cache without TTL', () => {
      const result = chatBuilder.cache('cache-key');
      expect(result).toBe(chatBuilder);
    });

    it('should set functions', () => {
      const functions: AIFunction[] = [
        {
          name: 'test',
          description: 'Test function',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      ];
      const result = chatBuilder.functions(functions);
      expect(result).toBe(chatBuilder);
    });

    it('should set functions with function call', () => {
      const functions: AIFunction[] = [
        {
          name: 'test',
          description: 'Test function',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      ];
      const result = chatBuilder.functions(functions, 'auto');
      expect(result).toBe(chatBuilder);
    });
  });

  describe('terminal operations', () => {
    const mockResponse: AICompletionResponse = {
      id: 'test-id',
      content: 'Test response',
      role: 'assistant',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model: 'gpt-4',
      finishReason: 'stop',
    };

    it('should send request and return response', async () => {
      mockHost.complete.mockResolvedValue(mockResponse);

      const result = await chatBuilder.send();

      expect(mockHost.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([{ role: 'user', content: 'Hello, world!' }]),
        }),
        {
          provider: undefined,
          userId: undefined,
          cacheKey: undefined,
          cacheTTL: undefined,
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should send request with all configurations', async () => {
      mockHost.complete.mockResolvedValue(mockResponse);

      const functions: AIFunction[] = [
        {
          name: 'test',
          description: 'Test function',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      ];

      await chatBuilder
        .system('System message')
        .user('Additional user')
        .assistant('Assistant message')
        .model('gpt-4')
        .temperature(0.7)
        .maxTokens(500)
        .topP(0.9)
        .provider('openai' as AIProvider)
        .userId('user123')
        .cache('cache-key', 3600)
        .functions(functions, 'auto')
        .send();

      expect(mockHost.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'System message' },
            { role: 'user', content: 'Hello, world!' },
            { role: 'user', content: 'Additional user' },
            { role: 'assistant', content: 'Assistant message' },
          ],
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 500,
          topP: 0.9,
          functions: functions,
          functionCall: 'auto',
        }),
        {
          provider: 'openai',
          userId: 'user123',
          cacheKey: 'cache-key',
          cacheTTL: 3600,
        }
      );
    });

    it('should return only text content', async () => {
      mockHost.complete.mockResolvedValue(mockResponse);

      const result = await chatBuilder.text();

      expect(result).toBe('Test response');
    });

    it('should parse JSON response', async () => {
      const jsonResponse = { key: 'value', number: 42 };
      mockHost.complete.mockResolvedValue({
        ...mockResponse,
        content: JSON.stringify(jsonResponse),
      });

      const result = await chatBuilder.json();

      expect(result).toEqual(jsonResponse);
    });

    it('should parse JSON response with markdown fences', async () => {
      const jsonResponse = { key: 'value', number: 42 };
      mockHost.complete.mockResolvedValue({
        ...mockResponse,
        content: '```json\n' + JSON.stringify(jsonResponse) + '\n```',
      });

      const result = await chatBuilder.json();

      expect(result).toEqual(jsonResponse);
    });

    it('should parse JSON response with generic markdown fences', async () => {
      const jsonResponse = { key: 'value', number: 42 };
      mockHost.complete.mockResolvedValue({
        ...mockResponse,
        content: '```\n' + JSON.stringify(jsonResponse) + '\n```',
      });

      const result = await chatBuilder.json();

      expect(result).toEqual(jsonResponse);
    });

    it('should throw error for invalid JSON', async () => {
      mockHost.complete.mockResolvedValue({
        ...mockResponse,
        content: 'Invalid JSON',
      });

      await expect(chatBuilder.json()).rejects.toThrow();
    });

    it('should stream response', async () => {
      const mockChunks: AIStreamChunk[] = [
        { id: 'chunk-1', content: 'Hello', delta: 'Hello', done: false },
        { id: 'chunk-2', content: ' world', delta: ' world', done: false },
        { id: 'chunk-3', content: '!', delta: '!', done: true },
      ];

      const asyncGenerator = (async function* () {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      })();

      mockHost.streamComplete.mockReturnValue(asyncGenerator);

      const chunks: AIStreamChunk[] = [];
      for await (const chunk of chatBuilder.stream()) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(mockChunks);
      expect(mockHost.streamComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([{ role: 'user', content: 'Hello, world!' }]),
        }),
        {
          provider: undefined,
          userId: undefined,
        }
      );
    });
  });

  describe('buildRequest', () => {
    it('should build minimal request', () => {
      const builder = new ChatBuilder(mockHost, 'Test');
      // Access private method through type assertion for testing
      const request = (builder as any).buildRequest();

      expect(request).toEqual({
        messages: [{ role: 'user', content: 'Test' }],
        model: undefined,
        temperature: undefined,
        maxTokens: undefined,
        topP: undefined,
        functions: undefined,
        functionCall: undefined,
      });
    });

    it('should build full request', () => {
      const functions: AIFunction[] = [
        {
          name: 'test',
          description: 'Test function',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      ];

      // Access private method through type assertion for testing
      const request = chatBuilder
        .system('System')
        .model('gpt-4')
        .temperature(0.7)
        .maxTokens(500)
        .topP(0.9)
        .functions(functions, 'auto');

      const builtRequest = (request as any).buildRequest() as AICompletionRequest;

      expect(builtRequest).toEqual({
        messages: [
          { role: 'system', content: 'System' },
          { role: 'user', content: 'Hello, world!' },
        ],
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 500,
        topP: 0.9,
        functions: functions,
        functionCall: 'auto',
      });
    });
  });
});
