/**
 * PII detection and redaction
 */

import type { PIIEntityType } from '../guardrails.types';

const PII_PATTERNS: Record<PIIEntityType, RegExp> = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b|\b\+?[0-9]{10,15}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/g,
  credit_card: /\b(?:\d{4}[-.\s]?){3}\d{4}\b|\b\d{13,19}\b/g,
};

const PII_REPLACEMENTS: Record<PIIEntityType, string> = {
  email: '[EMAIL_REDACTED]',
  phone: '[PHONE_REDACTED]',
  ssn: '[SSN_REDACTED]',
  credit_card: '[CARD_REDACTED]',
};

export function detectPII(
  text: string,
  entityTypes: PIIEntityType[] = ['email', 'phone', 'ssn', 'credit_card']
): { entities: PIIEntityType[]; matches: string[] } {
  const entities: PIIEntityType[] = [];
  const matches: string[] = [];

  for (const entityType of entityTypes) {
    const pattern = PII_PATTERNS[entityType];
    const found = text.match(pattern);
    if (found) {
      entities.push(entityType);
      matches.push(...found);
    }
  }

  return { entities, matches };
}

export function redactPII(
  text: string,
  entityTypes: PIIEntityType[] = ['email', 'phone', 'ssn', 'credit_card']
): string {
  let result = text;

  for (const entityType of entityTypes) {
    const pattern = PII_PATTERNS[entityType];
    const replacement = PII_REPLACEMENTS[entityType];
    result = result.replace(pattern, replacement);
  }

  return result;
}
