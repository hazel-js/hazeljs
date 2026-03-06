/**
 * @hazeljs/guardrails - Types and interfaces
 */

export type PIIEntityType = 'email' | 'phone' | 'ssn' | 'credit_card';

export interface GuardrailInputOptions {
  entityTypes?: PIIEntityType[];
  redactPII?: boolean;
  blockInjection?: boolean;
  blockToxicity?: boolean;
}

export interface GuardrailOutputOptions {
  allowPII?: boolean;
  schema?: object;
}

export interface GuardrailResult {
  allowed: boolean;
  modified?: string | object;
  violations?: string[];
  blockedReason?: string;
}

export interface GuardrailsModuleOptions {
  piiEntities?: PIIEntityType[];
  injectionBlocklist?: string[];
  toxicityBlocklist?: string[];
  redactPIIByDefault?: boolean;
  blockInjectionByDefault?: boolean;
  blockToxicityByDefault?: boolean;
}
