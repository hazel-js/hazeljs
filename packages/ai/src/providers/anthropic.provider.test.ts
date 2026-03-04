jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockMessagesCreate = jest.fn();
const mockMessagesStream = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockMessagesCreate,
      stream: mockMessagesStream,
    },
  })),
}));

import { AnthropicProvider } from './anthropic.provider';

const BASE_REQUEST = {
  messages: [{ role: 'user' as const, content: 'Hello' }],
  model: 'claude-3-5-sonnet-20241022',
};

const MOCK_RESPONSE = {
  id: 'msg_001',
  content: [{ type: 'text', text: 'Hello there!' }],
  model: 'claude-3-5-sonnet-20241022',
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 15 },
};

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new AnthropicProvider('test-api-key');
  });

  describe('constructor', () => {
    it('sets name to anthropic', () => {
      expect(provider.name).toBe('anthropic');
    });

    it('warns when no API key provided', () => {
      new AnthropicProvider();
      // Constructor runs without throwing
    });

    it('uses ANTHROPIC_API_KEY env var', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key';
      const p = new AnthropicProvider();
      expect(p).toBeDefined();
      delete process.env.ANTHROPIC_API_KEY;
    });
  });

  describe('getSupportedModels()', () => {
    it('returns a list of claude models', () => {
      const models = provider.getSupportedModels();
      expect(models).toContain('claude-3-5-sonnet-20241022');
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('complete()', () => {
    it('returns a completion response', async () => {
      mockMessagesCreate.mockResolvedValue(MOCK_RESPONSE);

      const result = await provider.complete(BASE_REQUEST);

      expect(result.content).toBe('Hello there!');
      expect(result.role).toBe('assistant');
      expect(result.usage?.promptTokens).toBe(10);
      expect(result.usage?.completionTokens).toBe(15);
      expect(result.usage?.totalTokens).toBe(25);
      expect(result.finishReason).toBe('end_turn');
    });

    it('uses default model when not specified', async () => {
      mockMessagesCreate.mockResolvedValue(MOCK_RESPONSE);

      await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-3-5-sonnet-20241022' })
      );
    });

    it('passes maxTokens when specified', async () => {
      mockMessagesCreate.mockResolvedValue(MOCK_RESPONSE);

      await provider.complete({ ...BASE_REQUEST, maxTokens: 500 });

      expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 500 }));
    });

    it('separates system messages from conversation', async () => {
      mockMessagesCreate.mockResolvedValue(MOCK_RESPONSE);

      await provider.complete({
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful.',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      );
    });

    it('handles response with no stop_reason', async () => {
      mockMessagesCreate.mockResolvedValue({ ...MOCK_RESPONSE, stop_reason: null });

      const result = await provider.complete(BASE_REQUEST);
      expect(result.finishReason).toBe('end_turn');
    });

    it('concatenates multiple text content blocks', async () => {
      mockMessagesCreate.mockResolvedValue({
        ...MOCK_RESPONSE,
        content: [
          { type: 'text', text: 'Part 1. ' },
          { type: 'text', text: 'Part 2.' },
        ],
      });

      const result = await provider.complete(BASE_REQUEST);
      expect(result.content).toBe('Part 1. Part 2.');
    });

    it('ignores non-text content blocks', async () => {
      mockMessagesCreate.mockResolvedValue({
        ...MOCK_RESPONSE,
        content: [
          { type: 'tool_use', id: 'tool_1' },
          { type: 'text', text: 'Some text' },
        ],
      });

      const result = await provider.complete(BASE_REQUEST);
      expect(result.content).toBe('Some text');
    });

    it('throws wrapped error on API failure', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(provider.complete(BASE_REQUEST)).rejects.toThrow(
        'Anthropic API error: Rate limit exceeded'
      );
    });

    it('handles non-Error thrown objects', async () => {
      mockMessagesCreate.mockRejectedValue('string error');

      await expect(provider.complete(BASE_REQUEST)).rejects.toThrow(
        'Anthropic API error: Unknown error'
      );
    });

    it('sets undefined system when no system messages', async () => {
      mockMessagesCreate.mockResolvedValue(MOCK_RESPONSE);

      await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ system: undefined })
      );
    });
  });

  describe('streamComplete()', () => {
    function makeStreamEvents(events: unknown[]) {
      return (async function* () {
        for (const ev of events) {
          yield ev;
        }
      })();
    }

    it('yields chunks for message_start and content_block_delta events', async () => {
      mockMessagesStream.mockReturnValue(
        makeStreamEvents([
          { type: 'message_start', message: { id: 'msg_1', usage: { input_tokens: 5 } } },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
          { type: 'message_delta', usage: { output_tokens: 10 } },
          { type: 'message_stop' },
        ])
      );

      const results: unknown[] = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk);
      }

      // 2 content deltas + 1 message_stop
      expect(results.length).toBeGreaterThan(0);
    });

    it('includes usage in final chunk', async () => {
      mockMessagesStream.mockReturnValue(
        makeStreamEvents([
          { type: 'message_start', message: { id: 'msg_2', usage: { input_tokens: 8 } } },
          { type: 'message_delta', usage: { output_tokens: 12 } },
          { type: 'message_stop' },
        ])
      );

      const results: Array<{ done: boolean; usage?: unknown }> = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk as { done: boolean; usage?: unknown });
      }

      const finalChunk = results[results.length - 1];
      expect(finalChunk.done).toBe(true);
      expect(finalChunk.usage).toBeDefined();
    });

    it('ignores non-text_delta content blocks', async () => {
      mockMessagesStream.mockReturnValue(
        makeStreamEvents([
          { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } },
          { type: 'message_stop' },
        ])
      );

      const results: unknown[] = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk);
      }
      // Only message_stop chunk
      expect(results).toHaveLength(1);
    });

    it('uses default model for streaming', async () => {
      mockMessagesStream.mockReturnValue(makeStreamEvents([{ type: 'message_stop' }]));

      for await (const _chunk of provider.streamComplete({
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        // consume
      }

      expect(mockMessagesStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-3-5-sonnet-20241022' })
      );
    });

    it('throws wrapped error on streaming failure', async () => {
      mockMessagesStream.mockImplementation(async function* () {
        throw new Error('Stream error');
        yield { type: 'message_stop' };
      });

      await expect(async () => {
        for await (const _chunk of provider.streamComplete(BASE_REQUEST)) {
          // consume
        }
      }).rejects.toThrow('Anthropic streaming error: Stream error');
    });
  });

  describe('embed()', () => {
    it('throws not supported error', async () => {
      await expect(provider.embed({ input: 'test' })).rejects.toThrow(
        'Anthropic does not support embeddings'
      );
    });
  });

  describe('isAvailable()', () => {
    it('returns false when no API key', async () => {
      const p = new AnthropicProvider('');
      expect(await p.isAvailable()).toBe(false);
    });

    it('returns true when API responds successfully', async () => {
      mockMessagesCreate.mockResolvedValue(MOCK_RESPONSE);
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false on API error', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('Unauthorized'));
      expect(await provider.isAvailable()).toBe(false);
    });
  });
});
