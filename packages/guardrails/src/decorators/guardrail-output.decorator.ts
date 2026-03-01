/**
 * @GuardrailOutput - Run output guardrails after method execution
 */

import 'reflect-metadata';
import { GuardrailsService } from '../guardrails.service';
import { GuardrailViolationError } from '../errors/guardrail-violation.error';
import type { GuardrailOutputOptions } from '../guardrails.types';

const GUARDRAIL_OUTPUT_METADATA_KEY = 'hazel:guardrail-output';

export function GuardrailOutput(options?: GuardrailOutputOptions): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    Reflect.defineMetadata(GUARDRAIL_OUTPUT_METADATA_KEY, options ?? {}, target, propertyKey);

    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const guardrailsService = (this as { guardrailsService?: GuardrailsService })
        .guardrailsService;

      if (!guardrailsService) {
        throw new Error(
          'GuardrailsService not found. Inject GuardrailsService in the constructor and import GuardrailsModule.'
        );
      }

      const result = await original.apply(this, args);

      const opts = Reflect.getMetadata(
        GUARDRAIL_OUTPUT_METADATA_KEY,
        target,
        propertyKey
      ) as GuardrailOutputOptions;

      const outputResult = guardrailsService.checkOutput(result as string | object, opts);

      if (!outputResult.allowed) {
        throw new GuardrailViolationError(
          outputResult.blockedReason ?? 'Output blocked by guardrails',
          outputResult.violations,
          outputResult.blockedReason
        );
      }

      return outputResult.modified ?? result;
    };

    return descriptor;
  };
}

export function getGuardrailOutputMetadata(
  target: object,
  propertyKey: string | symbol
): GuardrailOutputOptions | undefined {
  return Reflect.getMetadata(GUARDRAIL_OUTPUT_METADATA_KEY, target, propertyKey);
}
