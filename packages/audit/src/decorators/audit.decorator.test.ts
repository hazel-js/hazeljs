/// <reference types="jest" />
import 'reflect-metadata';
import { Audit, getAuditMetadata, hasAuditMetadata } from './audit.decorator';

describe('Audit decorator', () => {
  class TestClass {
    create() {}
    login() {}
    noAudit() {}
  }
  // Apply decorators manually to avoid TS decorator signature mismatch in test context
  const noopDescriptor: PropertyDescriptor = {
    value: () => {},
    writable: true,
    enumerable: false,
    configurable: true,
  };
  Audit('order.create')(TestClass.prototype, 'create', noopDescriptor);
  Audit({ action: 'user.login', resource: 'User' })(TestClass.prototype, 'login', noopDescriptor);

  const instance = new TestClass();

  it('should set metadata when using string shorthand', () => {
    expect(hasAuditMetadata(instance, 'create')).toBe(true);
    expect(getAuditMetadata(instance, 'create')).toEqual({ action: 'order.create' });
  });

  it('should set metadata when using options object', () => {
    expect(hasAuditMetadata(instance, 'login')).toBe(true);
    expect(getAuditMetadata(instance, 'login')).toEqual({
      action: 'user.login',
      resource: 'User',
    });
  });

  it('should return false for method without decorator', () => {
    expect(hasAuditMetadata(instance, 'noAudit')).toBe(false);
    expect(getAuditMetadata(instance, 'noAudit')).toBeUndefined();
  });

  it('should return undefined for unknown property', () => {
    expect(getAuditMetadata(instance, 'unknown' as keyof TestClass)).toBeUndefined();
    expect(hasAuditMetadata(instance, 'unknown' as keyof TestClass)).toBe(false);
  });
});
