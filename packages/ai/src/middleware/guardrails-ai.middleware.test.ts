import type { AICompletionRequest } from '../ai-enhanced.types';
import { createGuardrailPreflightMiddleware } from './guardrails-ai.middleware';

describe('createGuardrailPreflightMiddleware', () => {
  const next = jest.fn(async (_req: AICompletionRequest) => ({
    id: '1',
    content: 'ok',
    role: 'assistant' as const,
    model: 'm',
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes through when last message is not user', async () => {
    const mw = createGuardrailPreflightMiddleware({
      checkInput: jest.fn(),
    });
    const req: AICompletionRequest = {
      messages: [{ role: 'assistant', content: 'hi' }],
    };
    await mw.handle(req, next);
    expect(next).toHaveBeenCalledWith(req);
  });

  it('allows user string content when guardrail passes', async () => {
    const checkInput = jest.fn().mockReturnValue({ allowed: true });
    const mw = createGuardrailPreflightMiddleware({ checkInput });
    const req: AICompletionRequest = {
      messages: [{ role: 'user', content: 'hello' }],
    };
    await mw.handle(req, next);
    expect(checkInput).toHaveBeenCalledWith('hello');
    expect(next).toHaveBeenCalled();
  });

  it('checks flattened multipart user content', async () => {
    const checkInput = jest.fn().mockReturnValue({ allowed: true });
    const mw = createGuardrailPreflightMiddleware({ checkInput });
    const req: AICompletionRequest = {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'a' },
            { type: 'text', text: 'b' },
          ],
        },
      ],
    };
    await mw.handle(req, next);
    expect(checkInput).toHaveBeenCalledWith('a b');
  });

  it('throws with blockedReason when not allowed', async () => {
    const mw = createGuardrailPreflightMiddleware({
      checkInput: () => ({ allowed: false, blockedReason: 'blocked' }),
    });
    const req: AICompletionRequest = {
      messages: [{ role: 'user', content: 'x' }],
    };
    await expect(mw.handle(req, next)).rejects.toThrow('blocked');
    expect(next).not.toHaveBeenCalled();
  });

  it('throws default message when blocked without reason', async () => {
    const mw = createGuardrailPreflightMiddleware({
      checkInput: () => ({ allowed: false }),
    });
    const req: AICompletionRequest = {
      messages: [{ role: 'user', content: 'x' }],
    };
    await expect(mw.handle(req, next)).rejects.toThrow('Guardrail blocked input');
  });
});
