import { detectPII, redactPII } from './pii.check';

describe('pii.check', () => {
  describe('detectPII', () => {
    it('should detect email', () => {
      const result = detectPII('Contact me at john@example.com for details');
      expect(result.entities).toContain('email');
      expect(result.matches).toContain('john@example.com');
    });

    it('should detect phone (US format)', () => {
      const result = detectPII('Call 555-123-4567 or (555) 987-6543');
      expect(result.entities).toContain('phone');
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect SSN', () => {
      const result = detectPII('SSN: 123-45-6789');
      expect(result.entities).toContain('ssn');
      expect(result.matches).toContain('123-45-6789');
    });

    it('should detect credit card', () => {
      const result = detectPII('Card: 4111-1111-1111-1111');
      expect(result.entities).toContain('credit_card');
    });

    it('should detect multiple entity types', () => {
      const result = detectPII('Email: test@test.com, SSN: 123-45-6789');
      expect(result.entities).toContain('email');
      expect(result.entities).toContain('ssn');
      expect(result.matches).toContain('test@test.com');
      expect(result.matches).toContain('123-45-6789');
    });

    it('should return empty when no PII', () => {
      const result = detectPII('Hello world, no sensitive data here');
      expect(result.entities).toEqual([]);
      expect(result.matches).toEqual([]);
    });

    it('should respect entityTypes filter', () => {
      const result = detectPII('test@example.com and 123-45-6789', ['email']);
      expect(result.entities).toEqual(['email']);
      expect(result.matches).toContain('test@example.com');
    });
  });

  describe('redactPII', () => {
    it('should redact email', () => {
      const result = redactPII('Contact john@example.com');
      expect(result).toBe('Contact [EMAIL_REDACTED]');
    });

    it('should redact SSN', () => {
      const result = redactPII('SSN: 123-45-6789');
      expect(result).toBe('SSN: [SSN_REDACTED]');
    });

    it('should redact multiple entities', () => {
      const result = redactPII('Email: a@b.com, SSN: 123-45-6789');
      expect(result).toContain('[EMAIL_REDACTED]');
      expect(result).toContain('[SSN_REDACTED]');
    });

    it('should respect entityTypes', () => {
      const result = redactPII('a@b.com and 123-45-6789', ['email']);
      expect(result).toContain('[EMAIL_REDACTED]');
      expect(result).toContain('123-45-6789');
    });

    it('should return unchanged when no PII', () => {
      const input = 'No sensitive data';
      expect(redactPII(input)).toBe(input);
    });
  });
});
