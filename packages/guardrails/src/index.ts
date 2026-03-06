/**
 * @hazeljs/guardrails - Content safety, PII handling, and output validation
 */

export { GuardrailsModule, GUARDRAILS_SERVICE_TOKEN } from './guardrails.module';
export { GuardrailsService } from './guardrails.service';
export { GuardrailPipe } from './pipes/guardrail.pipe';
export { GuardrailInterceptor } from './interceptors/guardrail.interceptor';
export { GuardrailInput, getGuardrailInputMetadata } from './decorators/guardrail-input.decorator';
export {
  GuardrailOutput,
  getGuardrailOutputMetadata,
} from './decorators/guardrail-output.decorator';
export { GuardrailViolationError } from './errors/guardrail-violation.error';

export type {
  GuardrailInputOptions,
  GuardrailOutputOptions,
  GuardrailResult,
  GuardrailsModuleOptions,
  PIIEntityType,
} from './guardrails.types';

export type { GuardrailPipeOptions } from './pipes/guardrail.pipe';
export type { GuardrailInterceptorOptions } from './interceptors/guardrail.interceptor';
