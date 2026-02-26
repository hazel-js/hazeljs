import { isHazelEvent } from './events';

describe('isHazelEvent', () => {
  it('should return true for valid metric event', () => {
    expect(isHazelEvent({ type: 'metric', name: 'count', value: 1 })).toBe(true);
  });

  it('should return true for valid span event', () => {
    expect(isHazelEvent({ type: 'span', name: 'op', durationMs: 10, status: 'ok' })).toBe(true);
  });

  it('should return true for valid audit event', () => {
    expect(isHazelEvent({ type: 'audit', name: 'login', payload: {} })).toBe(true);
  });

  it('should return true for valid dataAccess event', () => {
    expect(isHazelEvent({ type: 'dataAccess', dataset: 'users', classification: 'PUBLIC' })).toBe(
      true
    );
  });

  it('should return true for valid aiCall event', () => {
    expect(isHazelEvent({ type: 'aiCall', model: 'gpt-4', promptHash: 'x', outputHash: 'y' })).toBe(
      true
    );
  });

  it('should return true for valid decision event', () => {
    expect(isHazelEvent({ type: 'decision', name: 'kyc', status: 'APPROVED', reasons: [] })).toBe(
      true
    );
  });

  it('should return false for null', () => {
    expect(isHazelEvent(null)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isHazelEvent('string')).toBe(false);
    expect(isHazelEvent(123)).toBe(false);
    expect(isHazelEvent(undefined)).toBe(false);
  });

  it('should return false for object with invalid type', () => {
    expect(isHazelEvent({ type: 'invalid' })).toBe(false);
    expect(isHazelEvent({ type: 123 })).toBe(false);
    expect(isHazelEvent({})).toBe(false);
  });
});
