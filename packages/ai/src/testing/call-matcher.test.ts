import { matchExpectedCalls, parseExpectedCalls } from './call-matcher';
import type { AICompletionRequest } from '../ai-enhanced.types';

function call(partial: Partial<AICompletionRequest>): AICompletionRequest {
  return {
    messages: partial.messages ?? [{ role: 'user', content: 'hi' }],
    model: partial.model,
    functions: partial.functions,
  };
}

describe('matchExpectedCalls', () => {
  it('passes subset match', () => {
    const r = matchExpectedCalls(
      [
        call({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'sys' },
            { role: 'user', content: 'hello world' },
          ],
          functions: [
            { name: 'echo', description: '', parameters: { type: 'object', properties: {} } },
          ],
        }),
      ],
      [
        {
          model: 'gpt-4o',
          messageRoles: ['system', 'user'],
          toolNames: ['echo'],
          messageIncludes: 'hello',
        },
      ]
    );
    expect(r.ok).toBe(true);
  });

  it('reports missing tool names', () => {
    const r = matchExpectedCalls(
      [
        call({
          functions: [
            { name: 'a', description: '', parameters: { type: 'object', properties: {} } },
          ],
        }),
      ],
      [{ toolNames: ['a', 'b'] }]
    );
    expect(r.ok).toBe(false);
    expect(r.failures[0].reason).toContain('toolNames missing');
  });

  it('parseExpectedCalls reads metadata', () => {
    expect(parseExpectedCalls({ expectedCalls: [{ model: 'm' }] })).toEqual([{ model: 'm' }]);
    expect(parseExpectedCalls({})).toEqual([]);
  });
});
