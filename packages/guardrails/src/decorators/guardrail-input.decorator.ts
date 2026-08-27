/**
 * @GuardrailInput - Run input guardrails before method execution
 */

import 'reflect-metadata';
import { GuardrailsService } from '../guardrails.service';
import { GuardrailViolationError } from '../errors/guardrail-violation.error';
import type { GuardrailInputOptions } from '../guardrails.types';

const GUARDRAIL_INPUT_METADATA_KEY = 'hazel:guardrail-input';

export function GuardrailInput(options?: GuardrailInputOptions): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    Reflect.defineMetadata(GUARDRAIL_INPUT_METADATA_KEY, options ?? {}, target, propertyKey);

    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const guardrailsService = (this as { guardrailsService?: GuardrailsService })
        .guardrailsService;

      if (!guardrailsService) {
        throw new Error(
          'GuardrailsService not found. Inject GuardrailsService in the constructor and import GuardrailsModule.'
        );
      }

      const opts = Reflect.getMetadata(
        GUARDRAIL_INPUT_METADATA_KEY,
        target,
        propertyKey
      ) as GuardrailInputOptions;

      const input = args[0];
      const result = guardrailsService.checkInput(input as string | object, opts);

      if (!result.allowed) {
        throw new GuardrailViolationError(
          result.blockedReason ?? 'Input blocked by guardrails',
          result.violations,
          result.blockedReason
        );
      }

      if (result.modified !== undefined) {
        args[0] = result.modified;
      }

      return original.apply(this, args);
    };

    return descriptor;
  };
}

export function getGuardrailInputMetadata(
  target: object,
  propertyKey: string | symbol
): GuardrailInputOptions | undefined {
  return Reflect.getMetadata(GUARDRAIL_INPUT_METADATA_KEY, target, propertyKey);
}
