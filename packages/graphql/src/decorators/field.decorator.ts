import 'reflect-metadata';
import type { FieldMetadata } from '../graphql.types';

export const FIELD_METADATA_KEY = Symbol('graphql:field');

/**
 * Marks a property or method as a GraphQL field
 *
 * @example
 * ```typescript
 * @ObjectType()
 * class User {
 *   @Field()
 *   id: string;
 *
 *   @Field()
 *   fullName(): string {
 *     return `${this.firstName} ${this.lastName}`;
 *   }
 * }
 * ```
 */
export function Field(
  nameOrOptions?: string | Partial<FieldMetadata>
): PropertyDecorator & MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) => {
    const meta: FieldMetadata =
      typeof nameOrOptions === 'string'
        ? { name: nameOrOptions, type: undefined }
        : { name: String(propertyKey), type: undefined, ...nameOrOptions };
    const existing: FieldMetadata[] = Reflect.getMetadata(FIELD_METADATA_KEY, target) || [];
    existing.push({ ...meta, name: meta.name || String(propertyKey) });
    Reflect.defineMetadata(FIELD_METADATA_KEY, existing, target);
  };
}

export function getFieldMetadata(target: object): FieldMetadata[] {
  return Reflect.getMetadata(FIELD_METADATA_KEY, target) || [];
}
