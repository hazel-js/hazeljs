import {
  createLLMProviderFromAI,
  type AIServiceAdapter,
} from '../../src/adapters/ai-provider.adapter';

describe('createLLMProviderFromAI', () => {
  it('should create LLMProvider that delegates to aiService.complete', async () => {
    const mockComplete = jest.fn().mockResolvedValue({
      content: 'Hello from AI',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop',
    });

    const aiService: AIServiceAdapter = { complete: mockComplete };
    const provider = createLLMProviderFromAI(aiService);

    const result = await provider.chat({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.content).toBe('Hello from AI');
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
    expect(result.finishReason).toBe('stop');
    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Hi', name: undefined }],
        model: undefined,
      })
    );
  });

  it('should use options.model as default when request has no model', async () => {
    const mockComplete = jest.fn().mockResolvedValue({ content: 'OK' });
    const aiService: AIServiceAdapter = { complete: mockComplete };
    const provider = createLLMProviderFromAI(aiService, { model: 'gpt-4' });

    await provider.chat({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4' })
    );
  });

  it('should pass request.model over options.model', async () => {
    const mockComplete = jest.fn().mockResolvedValue({ content: 'OK' });
    const aiService: AIServiceAdapter = { complete: mockComplete };
    const provider = createLLMProviderFromAI(aiService, { model: 'gpt-4' });

    await provider.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      model: 'claude-3',
    });

    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-3' })
    );
  });

  it('should pass tools/functions when provided', async () => {
    const mockComplete = jest.fn().mockResolvedValue({ content: 'OK' });
    const aiService: AIServiceAdapter = { complete: mockComplete };
    const provider = createLLMProviderFromAI(aiService);

    await provider.chat({
      messages: [{ role: 'user', content: 'Use get_weather' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
    });

    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        functions: [
          {
            name: 'get_weather',
            description: 'Get weather',
            parameters: { type: 'object', properties: {} },
          },
        ],
        functionCall: 'auto',
      })
    );
  });

  it('should not pass functions when tools array is empty', async () => {
    const mockComplete = jest.fn().mockResolvedValue({ content: 'OK' });
    const aiService: AIServiceAdapter = { complete: mockComplete };
    const provider = createLLMProviderFromAI(aiService);

    await provider.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      tools: [],
    });

    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        functions: undefined,
        functionCall: undefined,
      })
    );
  });

  it('should map toolCalls from response to tool_calls', async () => {
    const mockComplete = jest.fn().mockResolvedValue({
      content: '',
      toolCalls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
        },
      ],
    });

    const aiService: AIServiceAdapter = { complete: mockComplete };
    const provider = createLLMProviderFromAI(aiService);

    const result = await provider.chat({
      messages: [{ role: 'user', content: 'Weather?' }],
    });

    expect(result.tool_calls).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
      },
    ]);
  });

  it('should map legacy functionCall to tool_calls when toolCalls is absent', async () => {
    const mockComplete = jest.fn().mockResolvedValue({
      content: '',
      functionCall: {
        name: 'get_weather',
        arguments: '{"city":"LA"}',
      },
    });

    const aiService: AIServiceAdapter = { complete: mockComplete };
    const provider = createLLMProviderFromAI(aiService);

    const result = await provider.chat({
      messages: [{ role: 'user', content: 'Weather?' }],
    });

    expect(result.tool_calls).toBeDefined();
    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls![0].function.name).toBe('get_weather');
    expect(result.tool_calls![0].function.arguments).toBe('{"city":"LA"}');
    expect(result.tool_calls![0].id).toMatch(/^call_\d+$/);
  });

  it('should return empty content when response.content is undefined', async () => {
    const mockComplete = jest.fn().mockResolvedValue({});
    const aiService: AIServiceAdapter = { complete: mockComplete };
    const provider = createLLMProviderFromAI(aiService);

    const result = await provider.chat({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.content).toBe('');
  });

  it('should pass temperature, maxTokens, topP', async () => {
    const mockComplete = jest.fn().mockResolvedValue({ content: 'OK' });
    const aiService: AIServiceAdapter = { complete: mockComplete };
    const provider = createLLMProviderFromAI(aiService);

    await provider.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });

    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      })
    );
  });
});
