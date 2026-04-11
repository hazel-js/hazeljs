import type { AICompletionRequest, AICompletionResponse } from '../ai-enhanced.types';
import type { AIMiddleware, AICompletionHandler } from './ai-middleware';
import { messageContentToText } from '../utils/message-content';

export type GuardrailLike = {
  checkInput: (text: string) => { allowed: boolean; blockedReason?: string };
};

/**
 * Optional: block / sanitize user messages before they hit the LLM (e.g. @hazeljs/guardrails).
 */
export function createGuardrailPreflightMiddleware(guardrails: GuardrailLike): AIMiddleware {
  return {
    name: 'guardrails-preflight',
    async handle(
      request: AICompletionRequest,
      next: AICompletionHandler
    ): Promise<AICompletionResponse> {
      const msgs = request.messages;
      const last = msgs[msgs.length - 1];
      if (last?.role === 'user') {
        const text =
          typeof last.content === 'string' ? last.content : messageContentToText(last.content);
        const r = guardrails.checkInput(text);
        if (!r.allowed) {
          throw new Error(r.blockedReason || 'Guardrail blocked input');
        }
      }
      return next(request);
    },
  };
}
