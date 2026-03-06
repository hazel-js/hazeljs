jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockChatCreate = jest.fn();
const mockEmbedCreate = jest.fn();
const mockSpeechCreate = jest.fn();
const mockModelsList = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCreate } },
    embeddings: { create: mockEmbedCreate },
    audio: { speech: { create: mockSpeechCreate } },
    models: { list: mockModelsList },
  })),
}));

import { OpenAIProvider } from './openai.provider';

const BASE_REQUEST = {
  messages: [{ role: 'user' as const, content: 'Hello OpenAI' }],
  model: 'gpt-4',
};

const MOCK_COMPLETION = {
  id: 'chatcmpl-001',
  model: 'gpt-4',
  choices: [
    {
      message: { content: 'OpenAI response', tool_calls: undefined },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
};

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OpenAIProvider('test-api-key');
  });

  describe('constructor', () => {
    it('sets name to openai', () => {
      expect(provider.name).toBe('openai');
    });

    it('accepts custom config', () => {
      const p = new OpenAIProvider('key', {
        baseURL: 'http://custom',
        defaultModel: 'gpt-3.5-turbo',
      });
      expect(p).toBeDefined();
    });
  });

  describe('getSupportedModels()', () => {
    it('returns list including gpt-4', () => {
      const models = provider.getSupportedModels();
      expect(models).toContain('gpt-4');
    });
  });

  describe('getSupportedEmbeddingModels()', () => {
    it('returns embedding models', () => {
      const models = provider.getSupportedEmbeddingModels();
      expect(models).toContain('text-embedding-3-small');
    });
  });

  describe('complete()', () => {
    it('returns a completion response', async () => {
      mockChatCreate.mockResolvedValue(MOCK_COMPLETION);

      const result = await provider.complete(BASE_REQUEST);

      expect(result.content).toBe('OpenAI response');
      expect(result.role).toBe('assistant');
      expect(result.usage?.promptTokens).toBe(10);
      expect(result.usage?.completionTokens).toBe(20);
      expect(result.usage?.totalTokens).toBe(30);
      expect(result.finishReason).toBe('stop');
    });

    it('uses default model when not specified', async () => {
      mockChatCreate.mockResolvedValue(MOCK_COMPLETION);

      await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });

      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4-turbo-preview' })
      );
    });

    it('handles tool_calls in response', async () => {
      mockChatCreate.mockResolvedValue({
        ...MOCK_COMPLETION,
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'getWeather', arguments: '{"city":"NYC"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      });

      const result = await provider.complete(BASE_REQUEST);

      expect(result.functionCall?.name).toBe('getWeather');
      expect(result.toolCalls).toHaveLength(1);
    });

    it('passes functions as tools', async () => {
      mockChatCreate.mockResolvedValue(MOCK_COMPLETION);

      await provider.complete({
        ...BASE_REQUEST,
        functions: [
          {
            name: 'testFn',
            description: 'Test',
            parameters: { type: 'object' as const, properties: {} },
          },
        ],
      });

      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.arrayContaining([expect.objectContaining({ type: 'function' })]),
        })
      );
    });

    it('sets tool_choice auto when functionCall is "auto"', async () => {
      mockChatCreate.mockResolvedValue(MOCK_COMPLETION);

      await provider.complete({ ...BASE_REQUEST, functionCall: 'auto' });

      expect(mockChatCreate).toHaveBeenCalledWith(expect.objectContaining({ tool_choice: 'auto' }));
    });

    it('sets tool_choice none when functionCall is "none"', async () => {
      mockChatCreate.mockResolvedValue(MOCK_COMPLETION);

      await provider.complete({ ...BASE_REQUEST, functionCall: 'none' });

      expect(mockChatCreate).toHaveBeenCalledWith(expect.objectContaining({ tool_choice: 'none' }));
    });

    it('handles missing usage in response', async () => {
      mockChatCreate.mockResolvedValue({ ...MOCK_COMPLETION, usage: undefined });

      const result = await provider.complete(BASE_REQUEST);
      expect(result.usage).toBeUndefined();
    });

    it('throws when no choices returned', async () => {
      mockChatCreate.mockResolvedValue({ ...MOCK_COMPLETION, choices: [] });

      await expect(provider.complete(BASE_REQUEST)).rejects.toThrow();
    });

    it('wraps API errors with status code', async () => {
      mockChatCreate.mockRejectedValue({ status: 429, message: 'Rate limit' });

      await expect(provider.complete(BASE_REQUEST)).rejects.toThrow('OpenAI API Error (429)');
    });

    it('returns original Error when thrown', async () => {
      mockChatCreate.mockRejectedValue(new Error('Direct error'));

      await expect(provider.complete(BASE_REQUEST)).rejects.toThrow('Direct error');
    });

    it('wraps unknown thrown values', async () => {
      mockChatCreate.mockRejectedValue(null);

      await expect(provider.complete(BASE_REQUEST)).rejects.toThrow('Unknown OpenAI error');
    });
  });

  describe('complete() – message transformation', () => {
    it('transforms system messages', async () => {
      mockChatCreate.mockResolvedValue(MOCK_COMPLETION);

      await provider.complete({
        messages: [{ role: 'system', content: 'Be helpful' }],
      });

      const msgs = mockChatCreate.mock.calls[0][0].messages;
      expect(msgs[0].role).toBe('system');
    });

    it('transforms user messages', async () => {
      mockChatCreate.mockResolvedValue(MOCK_COMPLETION);

      await provider.complete({ messages: [{ role: 'user', content: 'Hello' }] });

      const msgs = mockChatCreate.mock.calls[0][0].messages;
      expect(msgs[0].role).toBe('user');
    });

    it('transforms assistant messages with functionCall to tool_calls', async () => {
      mockChatCreate.mockResolvedValue(MOCK_COMPLETION);

      await provider.complete({
        messages: [
          {
            role: 'assistant',
            content: '',
            functionCall: { name: 'fn', arguments: '{}' },
          },
        ],
      });

      const msgs = mockChatCreate.mock.calls[0][0].messages;
      expect(msgs[0].role).toBe('assistant');
      expect((msgs[0] as { tool_calls?: unknown[] }).tool_calls).toBeDefined();
    });

    it('transforms function/tool role messages', async () => {
      mockChatCreate.mockResolvedValue(MOCK_COMPLETION);

      await provider.complete({
        messages: [{ role: 'tool', content: 'result', toolCallId: 'call_1' }],
      });

      const msgs = mockChatCreate.mock.calls[0][0].messages;
      expect(msgs[0].role).toBe('tool');
    });

    it('transforms assistant messages with toolCalls', async () => {
      mockChatCreate.mockResolvedValue(MOCK_COMPLETION);

      await provider.complete({
        messages: [
          {
            role: 'assistant',
            content: '',
            toolCalls: [{ id: 'tc_1', type: 'function', function: { name: 'f', arguments: '{}' } }],
          },
        ],
      });

      const msgs = mockChatCreate.mock.calls[0][0].messages;
      expect(msgs[0].role).toBe('assistant');
    });

    it('defaults unknown role to assistant', async () => {
      mockChatCreate.mockResolvedValue(MOCK_COMPLETION);

      await provider.complete({
        messages: [{ role: 'unknown' as never, content: 'msg' }],
      });

      const msgs = mockChatCreate.mock.calls[0][0].messages;
      expect(msgs[0].role).toBe('assistant');
    });
  });

  describe('streamComplete()', () => {
    it('yields content chunks', async () => {
      async function* mockStream() {
        yield {
          id: 's1',
          choices: [{ delta: { content: 'Hello ' }, finish_reason: null }],
          usage: undefined,
        };
        yield {
          id: 's1',
          choices: [{ delta: { content: 'world' }, finish_reason: null }],
          usage: undefined,
        };
        yield {
          id: 's1',
          choices: [{ delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        };
      }

      mockChatCreate.mockResolvedValue(mockStream());

      const results: unknown[] = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it('includes usage in final chunk when finish_reason is set', async () => {
      async function* mockStream() {
        yield {
          id: 's2',
          choices: [{ delta: { content: 'end' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
        };
      }

      mockChatCreate.mockResolvedValue(mockStream());

      const results: Array<{ done: boolean; usage?: unknown }> = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk as { done: boolean; usage?: unknown });
      }

      const last = results[results.length - 1];
      expect(last.done).toBe(true);
    });

    it('skips chunks with empty content', async () => {
      async function* mockStream() {
        yield {
          id: 's3',
          choices: [{ delta: { content: '' }, finish_reason: null }],
          usage: undefined,
        };
        yield { id: 's3', choices: [{ delta: {}, finish_reason: 'stop' }], usage: undefined };
      }

      mockChatCreate.mockResolvedValue(mockStream());

      const results: unknown[] = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk);
      }

      // Only done chunk, no content chunks
      expect(results).toHaveLength(1);
    });

    it('throws on streaming error', async () => {
      mockChatCreate.mockRejectedValue(new Error('Stream failed'));

      await expect(async () => {
        for await (const _chunk of provider.streamComplete(BASE_REQUEST)) {
          // consume
        }
      }).rejects.toThrow();
    });
  });

  describe('embed()', () => {
    it('returns embeddings for string input', async () => {
      mockEmbedCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 5, total_tokens: 5 },
      });

      const result = await provider.embed({ input: 'hello' });

      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
    });

    it('returns multiple embeddings for array input', async () => {
      mockEmbedCreate.mockResolvedValue({
        data: [{ embedding: [0.1] }, { embedding: [0.2] }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 10, total_tokens: 10 },
      });

      const result = await provider.embed({ input: ['first', 'second'] });
      expect(result.embeddings).toHaveLength(2);
    });

    it('uses default model text-embedding-3-small', async () => {
      mockEmbedCreate.mockResolvedValue({
        data: [{ embedding: [0.1] }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 3, total_tokens: 3 },
      });

      const result = await provider.embed({ input: 'test' });
      expect(mockEmbedCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'text-embedding-3-small' })
      );
      expect(result.model).toBe('text-embedding-3-small');
    });

    it('throws on API failure', async () => {
      mockEmbedCreate.mockRejectedValue({ status: 500, message: 'Server error' });
      await expect(provider.embed({ input: 'test' })).rejects.toThrow();
    });
  });

  describe('speech()', () => {
    it('returns a Buffer from TTS', async () => {
      const fakeAudioData = new Uint8Array([1, 2, 3]).buffer;
      mockSpeechCreate.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(fakeAudioData),
      });

      const result = await provider.speech('Hello world', { voice: 'alloy' });

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('uses default voice alloy', async () => {
      const fakeAudioData = new Uint8Array([1]).buffer;
      mockSpeechCreate.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(fakeAudioData),
      });

      await provider.speech('test');

      expect(mockSpeechCreate).toHaveBeenCalledWith(expect.objectContaining({ voice: 'alloy' }));
    });

    it('falls back to alloy for invalid voice', async () => {
      const fakeAudioData = new Uint8Array([1]).buffer;
      mockSpeechCreate.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(fakeAudioData),
      });

      await provider.speech('test', { voice: 'invalid-voice' });

      expect(mockSpeechCreate).toHaveBeenCalledWith(expect.objectContaining({ voice: 'alloy' }));
    });

    it('throws when input exceeds 4096 characters', async () => {
      await expect(provider.speech('x'.repeat(4097))).rejects.toThrow(
        'TTS input must be 4096 characters'
      );
    });

    it('uses custom model and format', async () => {
      const fakeAudioData = new Uint8Array([1]).buffer;
      mockSpeechCreate.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(fakeAudioData),
      });

      await provider.speech('hello', { model: 'tts-1-hd', format: 'opus' });

      expect(mockSpeechCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'tts-1-hd', response_format: 'opus' })
      );
    });
  });

  describe('isAvailable()', () => {
    it('returns true when models.list() succeeds', async () => {
      mockModelsList.mockResolvedValue({ data: [] });
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when models.list() throws', async () => {
      mockModelsList.mockRejectedValue(new Error('Unauthorized'));
      expect(await provider.isAvailable()).toBe(false);
    });
  });
});
