import type { AnyAbility } from '@casl/ability';

/**
 * Abstract base class for user-defined ability factories.
 *
 * Extend this class and implement `createForUser` to define what actions a
 * given user can perform.  Register your factory with `CaslModule.forRoot()`.
 *
 * @example
 * ```ts
 * import { MongoAbility, createMongoAbility, AbilityBuilder } from '@casl/ability';
 * import { Injectable } from '@hazeljs/core';
 * import { AbilityFactory } from '@hazeljs/casl';
 *
 * type Action  = 'create' | 'read' | 'update' | 'delete' | 'manage';
 * type Subject = Post | 'Post' | 'all';
 * export type AppAbility = MongoAbility<[Action, Subject]>;
 *
 * @Injectable()
 * export class AppAbilityFactory extends AbilityFactory<AppAbility> {
 *   createForUser(user: AuthUser): AppAbility {
 *     const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
 *     if (user.role === 'admin') {
 *       can('manage', 'all');
 *     } else {
 *       can('read', 'Post');
 *       can('update', 'Post', { authorId: user.id }); // own posts only
 *       cannot('delete', 'Post');
 *     }
 *     return build();
 *   }
 * }
 * ```
 */
export abstract class AbilityFactory<A extends AnyAbility> {
  abstract createForUser(user: Record<string, unknown>): A;
}
