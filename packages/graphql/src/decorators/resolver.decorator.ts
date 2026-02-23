import 'reflect-metadata';
import type { ResolverMetadata } from '../graphql.types';

export const RESOLVER_METADATA_KEY = Symbol('graphql:resolver');

/**
 * Marks a class as a GraphQL resolver (contains @Query and @Mutation handlers)
 *
 * @example
 * ```typescript
 * @Resolver()
 * class UserResolver {
 *   @Query()
 *   user(@Arg('id') id: string) {
 *     return { id, name: 'John' };
 *   }
 *
 *   @Mutation()
 *   createUser(@Arg('name') name: string) {
 *     return { id: '1', name };
 *   }
 * }
 * ```
 */
export function Resolver(name?: string): ClassDecorator {
  return (target: object) => {
    const meta: ResolverMetadata = name ? { name } : {};
    Reflect.defineMetadata(RESOLVER_METADATA_KEY, meta, target);
  };
}

export function getResolverMetadata(target: object): ResolverMetadata | undefined {
  return Reflect.getMetadata(RESOLVER_METADATA_KEY, target);
}
