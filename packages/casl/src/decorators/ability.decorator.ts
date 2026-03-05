import 'reflect-metadata';
import type { RequestContext, Container } from '@hazeljs/core';
import { CaslService } from '../casl.service';

const INJECT_METADATA_KEY = 'hazel:inject';

/**
 * Parameter decorator that injects the current user's CASL ability directly
 * into a controller method parameter.
 *
 * Requires `JwtAuthGuard` (or any guard that sets `req.user`) to run before
 * the route handler, and `CaslModule.forRoot()` to be configured.
 *
 * The ability is resolved once per request by calling
 * `CaslService.createForUser(context.user)`.  No need to inject `CaslService`
 * into your services — pass the pre-built ability down instead.
 *
 * @example
 * ```ts
 * import { UseGuards } from '@hazeljs/core';
 * import { JwtAuthGuard } from '@hazeljs/auth';
 * import { Ability } from '@hazeljs/casl';
 * import type { AppAbility } from './casl/app-ability.factory';
 *
 * @UseGuards(JwtAuthGuard, RoleGuard('user'))
 * @Patch('/:id')
 * update(
 *   @Ability() ability: AppAbility,
 *   @Param('id') id: string,
 *   @Body() dto: UpdateTaskDto,
 * ) {
 *   return this.tasksService.update(ability, id, dto);
 * }
 * ```
 */
export function Ability(): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('@Ability() must be used on a method parameter');
    }

    const constructor = (target as { constructor: new (...args: unknown[]) => object }).constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) ?? [];

    injections[parameterIndex] = {
      type: 'custom',
      // Called by the router with (req, context, container) after guards have run.
      resolve: (
        _req: unknown,
        context: RequestContext,
        container: Container
      ): ReturnType<CaslService['createForUser']> => {
        const user = (context.user ?? {}) as Record<string, unknown>;
        const caslSvc = container.resolve(CaslService) as CaslService;
        return caslSvc.createForUser(user);
      },
    };

    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
  };
}
