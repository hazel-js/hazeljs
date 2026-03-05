import type { AnyAbility } from '@casl/ability';

/**
 * A function-style policy handler.  Receives the current user's ability and
 * returns `true` if the action is allowed.
 *
 * @example
 * ```ts
 * const canReadPost: PolicyHandler<AppAbility> =
 *   (ability) => ability.can('read', 'Post');
 * ```
 */
export type PolicyHandler<A extends AnyAbility = AnyAbility> = (ability: A) => boolean;

/**
 * Class-style policy handler.  Implement this interface and pass the class to
 * `@CheckPolicies()` when you need constructor-injected dependencies.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class CanCreatePost implements IPolicyHandler<AppAbility> {
 *   handle(ability: AppAbility) {
 *     return ability.can('create', 'Post');
 *   }
 * }
 * ```
 */
export interface IPolicyHandler<A extends AnyAbility = AnyAbility> {
  handle(ability: A): boolean | Promise<boolean>;
}

/** Union of the two supported handler shapes. */
export type AnyPolicyHandler<A extends AnyAbility = AnyAbility> =
  | PolicyHandler<A>
  | IPolicyHandler<A>;
