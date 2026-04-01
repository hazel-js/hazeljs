import { MLFacade } from '../ml.facade';
import { AIEnhancedService } from '../../ai-enhanced.service';
import type { HazelAIConfig, ClassifyOptions, ScoreOptions } from '../../platform/hazel-ai.types';

// Mock AIEnhancedService
jest.mock('../../ai-enhanced.service');
const MockedAIEnhancedService = AIEnhancedService as jest.MockedClass<typeof AIEnhancedService>;

describe('MLFacade', () => {
  let mlFacade: MLFacade;
  let mockAIService: jest.Mocked<AIEnhancedService>;
  let config: HazelAIConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    config = {
      provider: 'openai',
      model: 'gpt-4o',
    };

    mockAIService = {
      complete: jest.fn(),
    } as any;

    MockedAIEnhancedService.mockImplementation(() => mockAIService as any);
    mlFacade = new MLFacade(mockAIService, config);
  });

  describe('classify', () => {
    it('should classify text into provided labels', async () => {
      const text = 'I love this product!';
      const options: ClassifyOptions = {
        labels: ['positive', 'negative', 'neutral'],
      };
      const mockResponse = {
        id: 'test-id',
        content: '{"label":"positive","confidence":0.95}',
        role: 'assistant' as const,
        model: 'gpt-4o',
      };

      mockAIService.complete.mockResolvedValue(mockResponse);

      const result = await mlFacade.classify(text, options);

      expect(mockAIService.complete).toHaveBeenCalledWith(
        {
          messages: [
            {
              role: 'system',
              content:
                'You are a text classifier. Select exactly one label. Classify the given text into one of these labels: positive, negative, neutral. Respond with JSON: {"label":"...","confidence":0.0}',
            },
            { role: 'user', content: text },
          ],
          temperature: 0,
          responseFormat: 'json',
        },
        {
          provider: config.defaultProvider,
        }
      );
      expect(result).toEqual({
        label: 'positive',
        confidence: 0.95,
      });
    });

    it('should handle multi-label classification', async () => {
      const text = 'Complex text';
      const options: ClassifyOptions = {
        labels: ['tech', 'business', 'science'],
        multi: true,
      };
      const mockResponse = {
        id: 'test-id',
        content: '{"label":"tech","confidence":0.8}',
        role: 'assistant' as const,
        model: 'gpt-4o',
      };

      mockAIService.complete.mockResolvedValue(mockResponse);

      await mlFacade.classify(text, options);

      expect(mockAIService.complete).toHaveBeenCalledWith(
        {
          messages: [
            {
              role: 'system',
              content:
                'You are a text classifier. You may select multiple labels. Classify the given text into one of these labels: tech, business, science. Respond with JSON: {"label":"...","confidence":0.0}',
            },
            { role: 'user', content: text },
          ],
          temperature: 0,
          responseFormat: 'json',
        },
        {
          provider: config.defaultProvider,
        }
      );
    });

    it('should throw error for invalid JSON response', async () => {
      const text = 'Test';
      const options: ClassifyOptions = {
        labels: ['a', 'b'],
      };
      const mockResponse = {
        id: 'test-id',
        content: 'Invalid JSON',
        role: 'assistant' as const,
        model: 'gpt-4o',
      };

      mockAIService.complete.mockResolvedValue(mockResponse);

      await expect(mlFacade.classify(text, options)).rejects.toThrow(
        'Failed to parse classification response: Invalid JSON'
      );
    });

    it('should use custom provider from options', async () => {
      const text = 'Test';
      const options: ClassifyOptions = {
        labels: ['a', 'b'],
        provider: 'anthropic',
      };
      const mockResponse = {
        id: 'test-id',
        content: '{"label":"a","confidence":0.9}',
        role: 'assistant' as const,
        model: 'gpt-4o',
      };

      mockAIService.complete.mockResolvedValue(mockResponse);

      await mlFacade.classify(text, options);

      expect(mockAIService.complete).toHaveBeenCalledWith(expect.any(Object), {
        provider: 'anthropic',
      });
    });
  });

  describe('sentiment', () => {
    it('should analyze sentiment', async () => {
      const text = 'This is amazing!';
      const mockResponse = {
        id: 'test-id',
        content: '{"label":"positive","confidence":0.8}',
        role: 'assistant' as const,
        model: 'gpt-4o',
      };

      mockAIService.complete.mockResolvedValue(mockResponse);

      const result = await mlFacade.sentiment(text);

      expect(result).toEqual({
        sentiment: 'positive',
        score: 0.8,
      });
      expect(mockAIService.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('positive, negative, neutral'),
            }),
          ]),
        }),
        { provider: config.defaultProvider }
      );
    });
  });

  describe('score', () => {
    it('should score items against criteria', async () => {
      const prompt = 'Rate relevance';
      const options: ScoreOptions = {
        items: [
          { id: '1', text: 'TypeScript developer' },
          { id: '2', text: 'Python developer' },
        ],
        criteria: 'fit for Node.js role',
      };
      const mockResponse = {
        id: 'test-id',
        content:
          '[{"id":"1","score":0.9,"reasoning":"Has TypeScript experience"},{"id":"2","score":0.3,"reasoning":"Python only"}]',
        role: 'assistant' as const,
        model: 'gpt-4o',
      };

      mockAIService.complete.mockResolvedValue(mockResponse);

      const result = await mlFacade.score(prompt, options);

      expect(mockAIService.complete).toHaveBeenCalledWith(
        {
          messages: [
            {
              role: 'system',
              content:
                'You are a scoring assistant. Score each item from 0.0 to 1.0 based on the criteria: fit for Node.js role. Respond with JSON array: [{"id":"...","score":0.0,"reasoning":"..."}]',
            },
            {
              role: 'user',
              content: `${prompt}\n\nItems:\n- ID: 1\n  Text: TypeScript developer\n- ID: 2\n  Text: Python developer`,
            },
          ],
          temperature: 0,
          responseFormat: 'json',
        },
        {
          provider: config.defaultProvider,
        }
      );
      expect(result).toEqual([
        { id: '1', score: 0.9, reasoning: 'Has TypeScript experience' },
        { id: '2', score: 0.3, reasoning: 'Python only' },
      ]);
    });

    it('should throw error for invalid JSON in score response', async () => {
      const prompt = 'Test';
      const options: ScoreOptions = {
        items: [{ id: '1', text: 'Test' }],
        criteria: 'test criteria',
      };
      const mockResponse = {
        id: 'test-id',
        content: 'Invalid JSON',
        role: 'assistant' as const,
        model: 'gpt-4o',
      };

      mockAIService.complete.mockResolvedValue(mockResponse);

      await expect(mlFacade.score(prompt, options)).rejects.toThrow(
        'Failed to parse scoring response: Invalid JSON'
      );
    });
  });
});
