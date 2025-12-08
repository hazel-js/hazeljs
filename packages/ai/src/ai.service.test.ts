import { AIService } from './ai.service';
import { AITaskConfig, LLMProvider } from './ai.types';

// Mock OpenAI
const mockCreate = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

// Mock fetch
global.fetch = jest.fn();

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    service = new AIService();
    jest.clearAllMocks();
    mockCreate.mockReset();
  });

  describe('executeTask', () => {
    const mockConfig: AITaskConfig = {
      name: 'test-task',
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      prompt: 'Test prompt with {{input}}',
      outputType: 'json',
      temperature: 0.7,
      maxTokens: 100,
    };

    const mockInput = { test: 'data' };

    it('should execute task with OpenAI provider', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '{"result": "test"}',
            },
          },
        ],
      });

      const result = await service.executeTask(mockConfig, mockInput);
      expect(result).toEqual({ data: { result: 'test' } });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          messages: [
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Test prompt with'),
            }),
          ],
          temperature: 0.7,
          max_tokens: 100,
        })
      );
    });

    it('should execute task with Ollama provider', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ response: '{"result": "test"}' }),
      });

      const result = await service.executeTask(
        {
          ...mockConfig,
          provider: 'ollama',
        },
        mockInput
      );

      expect(result).toEqual({ data: { result: 'test' } });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"model":"gpt-3.5-turbo"'),
        })
      );
    });

    it('should execute task with custom provider', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ result: '{"result":"test"}' }),
      });

      const result = await service.executeTask(
        {
          ...mockConfig,
          provider: 'custom',
          customProvider: {
            url: 'http://custom-api.com',
            headers: { 'X-API-Key': 'test' },
            transformRequest: (input: unknown) => ({ transformed: input }),
            transformResponse: (data: unknown) => (data as { result: string }).result,
          },
        },
        mockInput
      );

      expect(result).toEqual({ data: { result: 'test' } });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://custom-api.com',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test',
          }),
          body: JSON.stringify({ transformed: mockInput }),
        })
      );
    });

    it('should handle unsupported provider', async () => {
      const result = await service.executeTask(
        {
          ...mockConfig,
          provider: 'anthropic' as LLMProvider,
        },
        mockInput
      );

      expect(result).toEqual({
        error: 'Provider anthropic not supported',
      });
    });

    it('should handle OpenAI API errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await service.executeTask(mockConfig, mockInput);
      expect(result).toEqual({
        error: 'API Error',
      });
    });

    it('should handle Ollama API errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      const result = await service.executeTask(
        {
          ...mockConfig,
          provider: 'ollama',
        },
        mockInput
      );

      expect(result).toEqual({
        error: 'Network Error',
      });
    });

    it('should handle custom provider errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Custom API Error'));

      const result = await service.executeTask(
        {
          ...mockConfig,
          provider: 'custom',
          customProvider: {
            url: 'http://custom-api.com',
          },
        },
        mockInput
      );

      expect(result).toEqual({
        error: 'Custom API Error',
      });
    });

    it('should handle invalid JSON response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'invalid json',
            },
          },
        ],
      });

      const result = await service.executeTask(mockConfig, mockInput);
      expect(result.error).toContain('Failed to parse response');
    });

    it('should handle different output types', async () => {
      // Test number output
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '42',
            },
          },
        ],
      });

      const numberResult = await service.executeTask(
        {
          ...mockConfig,
          outputType: 'number',
        },
        mockInput
      );
      expect(numberResult).toEqual({ data: 42 });

      // Test boolean output
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'true',
            },
          },
        ],
      });

      const booleanResult = await service.executeTask(
        {
          ...mockConfig,
          outputType: 'boolean',
        },
        mockInput
      );
      expect(booleanResult).toEqual({ data: true });

      // Test string output
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'test string',
            },
          },
        ],
      });

      const stringResult = await service.executeTask(
        {
          ...mockConfig,
          outputType: 'string',
        },
        mockInput
      );
      expect(stringResult).toEqual({ data: 'test string' });
    });

    it('should format prompt with context variables', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '{"result": "test"}',
            },
          },
        ],
      });

      const config: AITaskConfig = {
        ...mockConfig,
        prompt: 'Task: {{taskName}}\nInput: {{input}}\nDescription: {{description}}',
      };

      await service.executeTask(config, mockInput);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              content: expect.stringContaining('Task: test-task'),
            }),
          ],
        })
      );
    });
  });
});
