import { GuardrailViolationError } from './guardrail-violation.error';

describe('GuardrailViolationError', () => {
  it('should create error with message', () => {
    const err = new GuardrailViolationError('Blocked');
    expect(err.message).toBe('Blocked');
    expect(err.name).toBe('GuardrailViolationError');
  });

  it('should include violations', () => {
    const err = new GuardrailViolationError('Blocked', ['prompt_injection']);
    expect(err.violations).toEqual(['prompt_injection']);
  });

  it('should include blockedReason', () => {
    const err = new GuardrailViolationError('Blocked', [], 'Potential prompt injection');
    expect(err.blockedReason).toBe('Potential prompt injection');
  });

  it('should serialize to JSON', () => {
    const err = new GuardrailViolationError('Blocked', ['toxicity'], 'Toxic content');
    const json = err.toJSON();
    expect(json.message).toBe('Blocked');
    expect(json.violations).toEqual(['toxicity']);
    expect(json.blockedReason).toBe('Toxic content');
  });

  it('should be instanceof Error', () => {
    const err = new GuardrailViolationError('Test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(GuardrailViolationError);
  });
});
