import { Body, Controller, Post, Service } from '@hazeljs/core';
import { assembleContext, rememberPreference } from './desk-context';

@Service()
@Controller('/context')
export class ContextController {
  @Post('/assemble')
  async assemble(
    @Body()
    body: {
      query: string;
      userId?: string;
      sessionId?: string;
    }
  ) {
    if (!body?.query?.trim()) {
      return { error: 'query is required' };
    }
    const assembled = await assembleContext(body.query, {
      userId: body.userId,
      sessionId: body.sessionId,
    });
    return {
      sourcesUsed: assembled.sourcesUsed,
      rationale: assembled.plan.rationale,
      text: assembled.text,
      tokenEstimate: assembled.tokenEstimate,
    };
  }

  @Post('/remember')
  async remember(
    @Body()
    body: {
      userId?: string;
      key: string;
      value: string;
    }
  ) {
    if (!body?.key || body.value === undefined) {
      return { error: 'key and value are required' };
    }
    const userId = body.userId ?? 'http-user';
    await rememberPreference(userId, body.key, String(body.value));
    return { ok: true, userId, key: body.key, value: body.value };
  }
}
