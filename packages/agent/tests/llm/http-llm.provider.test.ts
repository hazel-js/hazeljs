/**
 * createHttpLlmProvider / createMockLlmProvider branch coverage
 */

import { createHttpLlmProvider, createMockLlmProvider } from '../../src/llm/http-llm.provider';
import type { LLMChatRequest } from '../../src/types/llm.types';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => body,
  } as Response;
}

describe('createHttpLlmProvider', () => {
  it('posts chat completions with defaults and maps usage + content', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init: init! });
      return jsonResponse({
        choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 2,
          total_tokens: 3,
        },
      });
    });

    const llm = createHttpLlmProvider({
      apiKey: 'sk-test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const res = await llm.chat({
      messages: [{ role: 'user', content: 'hey' }],
    } as LLMChatRequest);

    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hey' }],
    });
    expect(res.content).toBe('hi');
    expect(res.finishReason).toBe('stop');
    expect(res.usage).toEqual({
      promptTokens: 1,
      completionTokens: 2,
      totalTokens: 3,
    });
    expect(res.tool_calls).toBeUndefined();
  });

  it('uses custom baseUrl/model, tools, request model override, and tool_calls', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'c1',
                  type: 'function',
                  function: { name: 'ping', arguments: '{}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      })
    );

    const llm = createHttpLlmProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test/v1/',
      model: 'fallback-model',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const res = await llm.chat({
      model: 'override-model',
      messages: [{ role: 'user', content: 'x' }],
      temperature: 0.2,
      maxTokens: 10,
      tools: [
        {
          type: 'function',
          function: { name: 'ping', description: 'p', parameters: { type: 'object' } },
        },
      ],
    } as LLMChatRequest);

    expect(fetchImpl).toHaveBeenCalled();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(url).toBe('https://example.test/v1/chat/completions');
    expect(body.model).toBe('override-model');
    expect(body.tool_choice).toBe('auto');
    expect(body.tools).toHaveLength(1);
    expect(res.content).toBe('');
    expect(res.tool_calls).toEqual([
      { id: 'c1', type: 'function', function: { name: 'ping', arguments: '{}' } },
    ]);
    expect(res.usage).toBeUndefined();
  });

  it('defaults missing usage token fields to 0', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: 'ok' } }],
        usage: {},
      })
    );
    const llm = createHttpLlmProvider({
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const res = await llm.chat({ messages: [] } as LLMChatRequest);
    expect(res.usage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it('throws on non-OK responses', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse('boom', 502));
    const llm = createHttpLlmProvider({
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(llm.chat({ messages: [] } as LLMChatRequest)).rejects.toThrow(
      /LLM HTTP 502: boom/
    );
  });

  it('handles empty choices without throwing', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({}));
    const llm = createHttpLlmProvider({
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const res = await llm.chat({ messages: [] } as LLMChatRequest);
    expect(res.content).toBe('');
    expect(res.tool_calls).toBeUndefined();
  });
});

describe('createMockLlmProvider', () => {
  it('returns default and custom replies', async () => {
    expect((await createMockLlmProvider().chat({} as LLMChatRequest)).content).toBe('OK');
    expect((await createMockLlmProvider('custom').chat({} as LLMChatRequest)).content).toBe(
      'custom'
    );
  });
});
