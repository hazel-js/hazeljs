import { Injectable, CanActivate, ExecutionContext, Type } from '@hazeljs/core';
import type { AnyAbility } from '@casl/ability';
import { CaslService } from './casl.service';
import type { AnyPolicyHandler, IPolicyHandler, PolicyHandler } from './types';

function isClassHandler<A extends AnyAbility>(
  handler: AnyPolicyHandler<A>
): handler is IPolicyHandler<A> {
  return (
    typeof handler === 'object' &&
    handler !== null &&
    typeof (handler as IPolicyHandler<A>).handle === 'function'
  );
}

/**
 * Factory that returns a guard running all provided policy handlers against
 * the current user's CASL ability.  Every handler must return `true`; if any
 * returns `false` the guard throws a 403.
 *
 * Must be placed **after** `JwtAuthGuard` (or any guard that sets `req.user`).
 * Requires `CaslModule.forRoot()` to be configured.
 *
 * Accepts both function handlers and class-instance handlers:
 *
 * @example
 * ```ts
 * // Inline function handler
 * @UseGuards(JwtAuthGuard, PoliciesGuard((ability: AppAbility) => ability.can('read', 'Post')))
 * @Get('/')
 * list() { ... }
 *
 * // Class-instance handler (dependencies resolved manually or via new)
 * @UseGuards(JwtAuthGuard, PoliciesGuard(new CanCreatePost()))
 * @Post('/')
 * create() { ... }
 * ```
 *
 * Prefer the `@CheckPolicies()` decorator for cleaner syntax:
 *
 * ```ts
 * @CheckPolicies((ability: AppAbility) => ability.can('read', 'Post'))
 * @Get('/')
 * list() { ... }
 * ```
 */
export function PoliciesGuard<A extends AnyAbility>(
  ...handlers: AnyPolicyHandler<A>[]
): Type<CanActivate> {
  @Injectable()
  class PoliciesGuardMixin implements CanActivate {
    constructor(private readonly casl: CaslService<A>) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      if (handlers.length === 0) return true;

      const req = context.switchToHttp().getRequest() as Record<string, unknown>;
      const user = req.user as Record<string, unknown> | undefined;

      if (!user) {
        throw Object.assign(new Error('Unauthorized'), { status: 401 });
      }

      const ability = this.casl.createForUser(user);

      for (const handler of handlers) {
        let result: boolean;
        if (isClassHandler<A>(handler)) {
          result = await (handler as IPolicyHandler<A>).handle(ability);
        } else {
          result = (handler as PolicyHandler<A>)(ability);
        }

        if (!result) {
          throw Object.assign(new Error('Insufficient permissions for this action'), {
            status: 403,
          });
        }
      }

      return true;
    }
  }

  return PoliciesGuardMixin;
}
