import 'reflect-metadata';
import type { ObjectTypeMetadata } from '../graphql.types';

export const OBJECT_TYPE_METADATA_KEY = Symbol('graphql:object-type');

/**
 * Marks a class as a GraphQL object type
 *
 * @example
 * ```typescript
 * @ObjectType()
 * class User {
 *   @Field()
 *   id: string;
 *
 *   @Field()
 *   name: string;
 * }
 * ```
 */
export function ObjectType(nameOrOptions?: string | ObjectTypeMetadata): ClassDecorator {
  return (target: object) => {
    const meta: ObjectTypeMetadata =
      typeof nameOrOptions === 'string'
        ? { name: nameOrOptions }
        : (nameOrOptions ?? { name: (target as { name: string }).name });
    Reflect.defineMetadata(OBJECT_TYPE_METADATA_KEY, meta, target);
  };
}

export function getObjectTypeMetadata(target: object): ObjectTypeMetadata | undefined {
  const ctor =
    typeof target === 'function' ? target : (target as { constructor?: object }).constructor;
  return Reflect.getMetadata(OBJECT_TYPE_METADATA_KEY, ctor ?? target);
}
