/**
 * GuardrailsService - Content safety, PII, and output validation
 */

import { Injectable } from '@hazeljs/core';
import { sanitizeString } from '@hazeljs/core';
import type {
  GuardrailInputOptions,
  GuardrailOutputOptions,
  GuardrailResult,
  GuardrailsModuleOptions,
  PIIEntityType,
} from './guardrails.types';
import { detectPII, redactPII } from './checks/pii.check';
import { checkPromptInjection } from './checks/injection.check';
import { checkToxicity } from './checks/toxicity.check';

const DEFAULT_ENTITY_TYPES: PIIEntityType[] = ['email', 'phone', 'ssn', 'credit_card'];

@Injectable()
export class GuardrailsService {
  private static staticOptions: GuardrailsModuleOptions = {};
  private options: GuardrailsModuleOptions = {};

  constructor(options?: GuardrailsModuleOptions) {
    this.options = options ?? { ...GuardrailsService.staticOptions };
  }

  static configure(options: GuardrailsModuleOptions): void {
    GuardrailsService.staticOptions = { ...GuardrailsService.staticOptions, ...options };
  }

  configure(options: GuardrailsModuleOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Check input for guardrail violations
   */
  checkInput(input: string | object, options?: GuardrailInputOptions): GuardrailResult {
    const opts = this.mergeInputOptions(options);
    const text = this.extractText(input);

    if (!text) {
      return { allowed: true };
    }

    const violations: string[] = [];
    let modified: string | object | undefined;

    if (opts.blockInjection) {
      const injection = checkPromptInjection(text);
      if (injection.detected) {
        return {
          allowed: false,
          violations: ['prompt_injection'],
          blockedReason: 'Potential prompt injection detected',
        };
      }
    }

    if (opts.blockToxicity) {
      const toxicity = checkToxicity(text, {
        customKeywords: this.options.toxicityBlocklist,
      });
      if (toxicity.detected) {
        return {
          allowed: false,
          violations: ['toxicity'],
          blockedReason: 'Toxic content detected',
        };
      }
    }

    if (opts.redactPII) {
      const entityTypes = opts.entityTypes ?? this.options.piiEntities ?? DEFAULT_ENTITY_TYPES;
      const piiDetected = detectPII(text, entityTypes);
      if (piiDetected.entities.length > 0) {
        const redacted = redactPII(text, entityTypes);
        modified =
          typeof input === 'string' ? redacted : this.applyRedactionToObject(input, entityTypes);
        violations.push('pii_redacted');
      }
    }

    return {
      allowed: true,
      modified,
      violations: violations.length > 0 ? violations : undefined,
    };
  }

  /**
   * Check output for guardrail violations
   */
  checkOutput(output: string | object, options?: GuardrailOutputOptions): GuardrailResult {
    const text = this.extractText(output);

    if (!text) {
      return { allowed: true };
    }

    if (options?.allowPII !== true) {
      const entityTypes = this.options.piiEntities ?? DEFAULT_ENTITY_TYPES;
      const piiDetected = detectPII(text, entityTypes);
      if (piiDetected.entities.length > 0) {
        const redacted = redactPII(text, entityTypes);
        const modified =
          typeof output === 'string'
            ? redacted
            : this.applyRedactionToObject(output as object, entityTypes);
        return {
          allowed: true,
          modified,
          violations: ['pii_redacted'],
        };
      }
    }

    const toxicity = checkToxicity(text, {
      customKeywords: this.options.toxicityBlocklist,
    });
    if (toxicity.detected) {
      return {
        allowed: false,
        violations: ['toxicity'],
        blockedReason: 'Toxic content in output',
      };
    }

    if (options?.schema) {
      const schemaResult = this.validateSchema(output, options.schema);
      if (!schemaResult.valid) {
        return {
          allowed: false,
          violations: ['schema_validation'],
          blockedReason: schemaResult.error,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Redact PII from text
   */
  redactPII(text: string, entities?: PIIEntityType[]): string {
    const entityTypes = entities ?? this.options.piiEntities ?? DEFAULT_ENTITY_TYPES;
    return redactPII(text, entityTypes);
  }

  private mergeInputOptions(options?: GuardrailInputOptions): Required<GuardrailInputOptions> {
    return {
      entityTypes: options?.entityTypes ?? this.options.piiEntities ?? DEFAULT_ENTITY_TYPES,
      redactPII: options?.redactPII ?? this.options.redactPIIByDefault ?? false,
      blockInjection: options?.blockInjection ?? this.options.blockInjectionByDefault ?? true,
      blockToxicity: options?.blockToxicity ?? this.options.blockToxicityByDefault ?? true,
    };
  }

  private extractText(input: string | object): string {
    if (typeof input === 'string') {
      return sanitizeString(input);
    }
    if (input && typeof input === 'object') {
      if ('message' in input && typeof (input as { message: unknown }).message === 'string') {
        return sanitizeString((input as { message: string }).message);
      }
      if ('prompt' in input && typeof (input as { prompt: unknown }).prompt === 'string') {
        return sanitizeString((input as { prompt: string }).prompt);
      }
      if ('content' in input && typeof (input as { content: unknown }).content === 'string') {
        return sanitizeString((input as { content: string }).content);
      }
      return sanitizeString(JSON.stringify(input));
    }
    return '';
  }

  private applyRedactionToObject(obj: object, entityTypes: PIIEntityType[]): object {
    const str = JSON.stringify(obj);
    const redacted = redactPII(str, entityTypes);
    try {
      return JSON.parse(redacted) as object;
    } catch {
      return { _redacted: redacted };
    }
  }

  private validateSchema(
    output: string | object,
    schema: object
  ): { valid: boolean; error?: string } {
    if (typeof output === 'string') {
      try {
        const parsed = JSON.parse(output);
        return this.validateAgainstSchema(parsed, schema);
      } catch {
        return { valid: false, error: 'Output is not valid JSON' };
      }
    }
    return this.validateAgainstSchema(output, schema);
  }

  private validateAgainstSchema(data: unknown, schema: object): { valid: boolean; error?: string } {
    if (typeof schema !== 'object' || schema === null) {
      return { valid: true };
    }

    const s = schema as { type?: string; properties?: Record<string, unknown> };
    if (s.type === 'object' && s.properties) {
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return { valid: false, error: 'Expected object' };
      }
      for (const [key, propSchema] of Object.entries(s.properties)) {
        const prop = propSchema as { required?: boolean };
        if (prop?.required && !(key in (data as object))) {
          return { valid: false, error: `Missing required property: ${key}` };
        }
      }
    }

    return { valid: true };
  }
}
