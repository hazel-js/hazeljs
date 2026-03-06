/**
 * GuardrailPipe - Input guardrails for HTTP request body/query
 */

import { Injectable, PipeTransform } from '@hazeljs/core';
import type { RequestContext } from '@hazeljs/core';
import { GuardrailsService } from '../guardrails.service';
import { GuardrailViolationError } from '../errors/guardrail-violation.error';
import type { GuardrailInputOptions } from '../guardrails.types';

export type GuardrailPipeOptions = GuardrailInputOptions;

@Injectable()
export class GuardrailPipe implements PipeTransform {
  constructor(private readonly guardrailsService: GuardrailsService) {}

  transform<T>(value: T, _context: RequestContext): T | Promise<T> {
    const result = this.guardrailsService.checkInput(value as string | object);

    if (!result.allowed) {
      throw new GuardrailViolationError(
        result.blockedReason ?? 'Input blocked by guardrails',
        result.violations,
        result.blockedReason
      );
    }

    if (result.modified !== undefined) {
      return result.modified as T;
    }

    return value;
  }
}
