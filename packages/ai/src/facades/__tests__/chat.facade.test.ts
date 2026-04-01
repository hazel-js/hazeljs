import { ChatFacade } from '../chat.facade';
import { AIEnhancedService } from '../../ai-enhanced.service';
import type { HazelAIConfig, ChatOptions } from '../../platform/hazel-ai.types';

// Mock AIEnhancedService
jest.mock('../../ai-enhanced.service');
const MockedAIEnhancedService = AIEnhancedService as jest.MockedClass<typeof AIEnhancedService>;

describe('ChatFacade', () => {
  let chatFacade: ChatFacade;
  let mockAIService: jest.Mocked<AIEnhancedService>;
  let config: HazelAIConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    config = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 1000,
    };

    mockAIService = {
      complete: jest.fn(),
      streamComplete: jest.fn(),
    } as any;

    MockedAIEnhancedService.mockImplementation(() => mockAIService as any);
    chatFacade = new ChatFacade(mockAIService, config);
  });

  describe('chat', () => {
    it('should send a simple message and return response', async () => {
      const message = 'Hello, world!';
      const expectedResponse = {
        id: 'test-id',
        content: 'Hi there!',
        role: 'assistant' as const,
        model: 'gpt-4o',
      };

      mockAIService.complete.mockResolvedValue(expectedResponse);

      const result = await chatFacade.chat(message);

      expect(mockAIService.complete).toHaveBeenCalledWith(
        {
          messages: [{ role: 'user', content: message }],
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          responseFormat: undefined,
        },
        {
          provider: config.defaultProvider,
        }
      );
      expect(result).toBe(expectedResponse.content);
    });

    it('should include system prompt when provided', async () => {
      const message = 'Test';
      const systemPrompt = 'You are a helpful assistant.';
      const expectedResponse = {
        id: 'test-id',
        content: 'Response',
        role: 'assistant' as const,
        model: 'gpt-4o',
      };

      mockAIService.complete.mockResolvedValue(expectedResponse);

      await chatFacade.chat(message, { systemPrompt });

      expect(mockAIService.complete).toHaveBeenCalledWith(
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          responseFormat: undefined,
        },
        {
          provider: config.defaultProvider,
        }
      );
    });

    it('should override config with options', async () => {
      const message = 'Test';
      const options: ChatOptions = {
        provider: 'anthropic',
        model: 'claude-sonnet-4',
        temperature: 0.5,
        maxTokens: 500,
        responseFormat: 'json',
      };
      const expectedResponse = {
        id: 'test-id',
        content: '{"result": "ok"}',
        role: 'assistant' as const,
        model: 'claude-sonnet-4',
      };

      mockAIService.complete.mockResolvedValue(expectedResponse);

      await chatFacade.chat(message, options);

      expect(mockAIService.complete).toHaveBeenCalledWith(
        {
          messages: [{ role: 'user', content: message }],
          model: options.model,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          responseFormat: options.responseFormat,
        },
        {
          provider: options.provider,
        }
      );
    });
  });

  describe('stream', () => {
    it('should stream response chunks', async () => {
      const message = 'Stream test';
      const chunks = [
        { id: '1', content: 'Hello', delta: 'Hello', done: false },
        { id: '2', content: 'Hello there', delta: ' there', done: false },
        { id: '3', content: 'Hello there!', delta: '!', done: true },
      ];

      const mockGenerator = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      mockAIService.streamComplete.mockReturnValue(mockGenerator);

      const result: string[] = [];
      for await (const chunk of chatFacade.stream(message)) {
        result.push(chunk);
      }

      expect(mockAIService.streamComplete).toHaveBeenCalledWith(
        {
          messages: [{ role: 'user', content: message }],
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          responseFormat: undefined,
        },
        {
          provider: config.defaultProvider,
        }
      );
      expect(result).toEqual(['Hello', ' there', '!']);
    });

    it('should include system prompt in stream', async () => {
      const message = 'Test';
      const systemPrompt = 'System message';
      const mockGenerator = (async function* () {
        yield { id: '1', content: 'Response', delta: 'Response', done: true };
      })();

      mockAIService.streamComplete.mockReturnValue(mockGenerator);

      for await (const _chunk of chatFacade.stream(message, { systemPrompt })) {
        // Just consume the generator
      }

      expect(mockAIService.streamComplete).toHaveBeenCalledWith(
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          responseFormat: undefined,
        },
        {
          provider: config.defaultProvider,
        }
      );
    });
  });
});
