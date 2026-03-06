/**
 * @Audit - Mark a handler or method as audited with custom action/resource
 */

const AUDIT_METADATA_KEY = 'hazel:audit';

export interface AuditDecoratorOptions {
  /** Action name (e.g. 'order.create', 'user.login') */
  action: string;
  /** Resource type or name (e.g. 'Order', 'User') */
  resource?: string;
  /** Include result in audit (success/failure from return or throw) */
  includeResult?: boolean;
}

export function Audit(options: AuditDecoratorOptions | string): MethodDecorator {
  const opts: AuditDecoratorOptions = typeof options === 'string' ? { action: options } : options;
  return function (
    target: object,
    propertyKey: string | symbol,
    _descriptor?: PropertyDescriptor
  ): void {
    Reflect.defineMetadata(AUDIT_METADATA_KEY, opts, target, propertyKey);
  } as MethodDecorator;
}

export function getAuditMetadata(
  target: object,
  propertyKey: string | symbol
): AuditDecoratorOptions | undefined {
  return Reflect.getMetadata(AUDIT_METADATA_KEY, target, propertyKey);
}

export function hasAuditMetadata(target: object, propertyKey: string | symbol): boolean {
  return Reflect.hasMetadata(AUDIT_METADATA_KEY, target, propertyKey);
}
