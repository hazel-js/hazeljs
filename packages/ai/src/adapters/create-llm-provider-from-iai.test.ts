import { createLLMProviderFromIAI } from './create-llm-provider-from-iai';
import type { IAIProvider } from '../ai-enhanced.types';

function mockProvider(partial: { complete?: jest.Mock; streamComplete?: jest.Mock }): IAIProvider {
  const complete =
    partial.complete ??
    jest.fn().mockResolvedValue({
      content: 'hello',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });
  const streamComplete =
    partial.streamComplete ??
    jest.fn().mockImplementation(async function* () {
      yield { delta: 'a', done: false };
      yield { delta: 'b', done: true, usage: { totalTokens: 2 } };
    });
  return {
    name: 'openai',
    complete,
    streamComplete,
    embed: jest.fn(),
    isAvailable: jest.fn().mockResolvedValue(true),
  };
}

describe('createLLMProviderFromIAI', () => {
  it('chat forwards to complete and maps response', async () => {
    const iai = mockProvider({});
    const bridge = createLLMProviderFromIAI(iai, 'gpt-4');
    const out = await bridge.chat({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'gpt-4',
    });
    expect(out.content).toBe('hello');
    expect(iai.complete).toHaveBeenCalled();
  });

  it('chat maps toolCalls to tool_calls', async () => {
    const complete = jest.fn().mockResolvedValue({
      content: '',
      toolCalls: [{ id: '1', type: 'function', function: { name: 'fn', arguments: '{}' } }],
    });
    const iai = mockProvider({ complete });
    const bridge = createLLMProviderFromIAI(iai);
    const out = await bridge.chat({
      messages: [{ role: 'user', content: 'call tool' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'fn',
            description: 'd',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        },
      ],
    });
    expect(out.tool_calls).toHaveLength(1);
    expect(out.tool_calls?.[0].function.name).toBe('fn');
  });

  it('chat maps legacy functionCall to tool_calls', async () => {
    const complete = jest.fn().mockResolvedValue({
      content: '',
      functionCall: { name: 'legacy', arguments: '{}' },
    });
    const iai = mockProvider({ complete });
    const bridge = createLLMProviderFromIAI(iai);
    const out = await bridge.chat({ messages: [{ role: 'user', content: 'x' }] });
    expect(out.tool_calls?.[0].function.name).toBe('legacy');
  });

  it('streamChat yields chunks from streamComplete', async () => {
    const iai = mockProvider({});
    const bridge = createLLMProviderFromIAI(iai, 'gpt-4');
    const chunks: string[] = [];
    for await (const c of bridge.streamChat!({ messages: [{ role: 'user', content: 's' }] })) {
      chunks.push(c.content ?? '');
    }
    expect(chunks.join('')).toBe('ab');
  });

  it('isAvailable delegates to provider', async () => {
    const iai = mockProvider({});
    const bridge = createLLMProviderFromIAI(iai);
    await bridge.isAvailable!();
    expect(iai.isAvailable).toHaveBeenCalled();
  });
});
