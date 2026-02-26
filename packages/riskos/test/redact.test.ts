/**
 * PII redaction tests
 */

import { redactPii, redactPiiDeep } from '../src';
import { redactLast } from '../src/utils/redact';

describe('redactLast', () => {
  it('redacts string keeping last N chars', () => {
    expect(redactLast('1234567890', 4)).toBe('******7890');
  });

  it('returns *** when string too short', () => {
    expect(redactLast('ab', 4)).toBe('***');
  });
});

describe('redactPii', () => {
  it('redacts known PII fields', () => {
    const obj = { email: 'a@b.com', name: 'John', score: 100 };
    const out = redactPii(obj);
    expect(out.email).toBe('[REDACTED]');
    expect(out.name).toBe('[REDACTED]');
    expect(out.score).toBe(100);
  });

  it('accepts custom fields', () => {
    const obj = { customId: 'secret' };
    const out = redactPii(obj, ['customId']);
    expect(out.customId).toBe('[REDACTED]');
  });
});

describe('redactPiiDeep', () => {
  it('redacts nested PII', () => {
    const obj = { user: { email: 'x@y.com' } };
    const out = redactPiiDeep(obj) as Record<string, unknown>;
    expect(out.user).toEqual({ email: '[REDACTED]' });
  });

  it('handles arrays', () => {
    const obj = [{ email: 'a@b.com' }];
    const out = redactPiiDeep(obj) as Array<Record<string, unknown>>;
    expect(out[0].email).toBe('[REDACTED]');
  });
});
