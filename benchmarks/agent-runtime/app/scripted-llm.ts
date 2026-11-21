/** Test-only deterministic planner — not a production model. */
import type { LLMProvider, LLMChatRequest, LLMChatResponse } from '@hazeljs/agent';

export function scriptedRefundLlm(orderId: string, amountMinor: number): LLMProvider {
  return {
    async chat(req: LLMChatRequest): Promise<LLMChatResponse> {
      const blob = (req.messages ?? []).map((m) => m.content ?? '').join('\n');
      if (/\[Tool(?: result)?:[^\]]*refund/i.test(blob)) {
        return { content: 'Refund workflow finished.', finishReason: 'stop' };
      }
      if (!/\[Tool(?: result)?:[^\]]*read_order/i.test(blob)) {
        return {
          content: '',
          finishReason: 'tool_calls',
          tool_calls: [
            {
              id: 'call_read',
              type: 'function',
              function: {
                name: 'read_order',
                arguments: JSON.stringify({ orderId }),
              },
            },
          ],
        };
      }
      return {
        content: '',
        finishReason: 'tool_calls',
        tool_calls: [
          {
            id: 'call_refund',
            type: 'function',
            function: {
              name: 'refund',
              arguments: JSON.stringify({
                orderId,
                amountMinor,
                currency: 'USD',
                reason: 'conformance_synthetic_refund',
              }),
            },
          },
        ],
      };
    },
  };
}
