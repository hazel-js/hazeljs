import { Injectable, CanActivate, ExecutionContext, Type } from '@hazeljs/core';
import { AuthUser } from '../auth.service';
import { RoleHierarchy, DEFAULT_ROLE_HIERARCHY, RoleHierarchyMap } from '../utils/role-hierarchy';

export interface RoleGuardOptions {
  /**
   * Custom role hierarchy to use instead of DEFAULT_ROLE_HIERARCHY.
   * Pass a plain map or a RoleHierarchy instance.
   */
  hierarchy?: RoleHierarchyMap | RoleHierarchy;
}

/**
 * Factory that returns a guard allowing only users whose role satisfies at
 * least one of the provided roles — directly or via the role hierarchy.
 *
 * By default uses DEFAULT_ROLE_HIERARCHY so `admin` automatically passes a
 * `manager` check, `manager` passes a `user` check, etc.
 *
 * Must be used after JwtAuthGuard (or any guard that attaches `user` to the
 * request).
 *
 * @example
 * ```ts
 * // admin, manager, AND user can access this:
 * @UseGuards(JwtAuthGuard, RoleGuard('user'))
 *
 * // Only admin and above (superadmin) can access this:
 * @UseGuards(JwtAuthGuard, RoleGuard('admin'))
 *
 * // Custom hierarchy (no inheritance):
 * @UseGuards(JwtAuthGuard, RoleGuard('admin', { hierarchy: {} }))
 *
 * // Multiple accepted roles:
 * @UseGuards(JwtAuthGuard, RoleGuard('admin', 'moderator'))
 * ```
 */
export function RoleGuard(...args: Array<string | RoleGuardOptions>): Type<CanActivate> {
  // Separate trailing options object from role strings
  const lastArg = args[args.length - 1];
  const hasOptions = typeof lastArg === 'object' && lastArg !== null;
  const roles = (hasOptions ? args.slice(0, -1) : args) as string[];
  const options = (hasOptions ? lastArg : {}) as RoleGuardOptions;

  const hierarchyInstance =
    options.hierarchy instanceof RoleHierarchy
      ? options.hierarchy
      : new RoleHierarchy(
          (options.hierarchy as RoleHierarchyMap | undefined) ?? DEFAULT_ROLE_HIERARCHY
        );

  @Injectable()
  class RoleGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest() as Record<string, unknown>;
      const user = req.user as AuthUser | undefined;

      if (!user) {
        const err = Object.assign(new Error('Unauthorized'), { status: 401 });
        throw err;
      }

      const permitted = roles.some((required) => hierarchyInstance.satisfies(user.role, required));

      if (!permitted) {
        const err = Object.assign(
          new Error(`Requires one of the following roles: ${roles.join(', ')}`),
          { status: 403 }
        );
        throw err;
      }

      return true;
    }
  }

  return RoleGuardMixin;
}
