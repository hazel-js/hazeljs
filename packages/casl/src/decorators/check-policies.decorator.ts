import 'reflect-metadata';
import type { AnyAbility } from '@casl/ability';
import type { AnyPolicyHandler } from '../types';
import { PoliciesGuard } from '../policy.guard';

/**
 * Shorthand method decorator that registers one or more CASL policy handlers
 * directly on the route — equivalent to `@UseGuards(PoliciesGuard(...handlers))`.
 *
 * Accepts both **function** handlers and **class-instance** handlers that
 * implement `IPolicyHandler`.
 *
 * > Requires `JwtAuthGuard` (or any guard that sets `req.user`) to run first,
 * > and `CaslModule.forRoot()` to be configured.
 *
 * @example
 * ```ts
 * // Function handler (inline, no DI needed)
 * @CheckPolicies((ability: AppAbility) => ability.can('read', 'Post'))
 * @Get('/')
 * list() { ... }
 *
 * // Multiple handlers — all must pass
 * @CheckPolicies(
 *   (ability: AppAbility) => ability.can('read',   'Post'),
 *   (ability: AppAbility) => ability.can('update', 'Post'),
 * )
 * @Get('/:id/edit')
 * editForm() { ... }
 * ```
 */
export function CheckPolicies<A extends AnyAbility>(
  ...handlers: AnyPolicyHandler<A>[]
): MethodDecorator {
  const guardClass = PoliciesGuard<A>(...handlers);

  // `target` is the class prototype; `propertyKey` is the method name.
  // This mirrors the exact metadata key/target pair that @UseGuards uses for
  // method-level guards, and that the HazelJS router reads.
  return (target, propertyKey, descriptor) => {
    const existing: unknown[] = Reflect.getMetadata('hazel:guards', target, propertyKey) ?? [];
    Reflect.defineMetadata('hazel:guards', [...existing, guardClass], target, propertyKey);
    return descriptor;
  };
}
