/**
 * GuardrailInterceptor - Input/output guardrails for HTTP requests
 */

import { Injectable } from '@hazeljs/core';
import type { Interceptor } from '@hazeljs/core';
import type { RequestContext } from '@hazeljs/core';
import { GuardrailsService } from '../guardrails.service';
import { GuardrailViolationError } from '../errors/guardrail-violation.error';
import type { GuardrailInputOptions, GuardrailOutputOptions } from '../guardrails.types';

export interface GuardrailInterceptorOptions {
  input?: GuardrailInputOptions;
  output?: GuardrailOutputOptions;
  checkOutput?: boolean;
}

@Injectable()
export class GuardrailInterceptor implements Interceptor {
  constructor(private readonly guardrailsService: GuardrailsService) {}

  async intercept(context: RequestContext, next: () => Promise<unknown>): Promise<unknown> {
    if (context.body) {
      const result = this.guardrailsService.checkInput(context.body as string | object, undefined);

      if (!result.allowed) {
        throw new GuardrailViolationError(
          result.blockedReason ?? 'Input blocked by guardrails',
          result.violations,
          result.blockedReason
        );
      }

      if (result.modified !== undefined) {
        context.body = result.modified;
      }
    }

    const response = await next();

    if (response !== undefined && response !== null) {
      const result = this.guardrailsService.checkOutput(response as string | object, undefined);

      if (!result.allowed) {
        throw new GuardrailViolationError(
          result.blockedReason ?? 'Output blocked by guardrails',
          result.violations,
          result.blockedReason
        );
      }
    }

    return response;
  }
}
