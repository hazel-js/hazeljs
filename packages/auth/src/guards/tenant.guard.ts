import { Injectable, CanActivate, ExecutionContext, Type, RequestContext } from '@hazeljs/core';
import { AuthUser } from '../auth.service';
import { TenantContext } from '../tenant/tenant-context';

export interface TenantGuardOptions {
  /**
   * Where to read the expected tenant ID from the incoming request.
   *
   * - `'param'`   — URL segment, e.g. `/orgs/:tenantId/products`  (default)
   * - `'header'`  — HTTP header, e.g. `X-Tenant-ID`
   * - `'query'`   — Query string, e.g. `?tenantId=acme`
   *
   * @default 'param'
   */
  source?: 'param' | 'header' | 'query';

  /**
   * Name of the param / header / query key that carries the tenant ID.
   * @default 'tenantId'
   */
  key?: string;

  /**
   * Field on the authenticated user object that holds the user's tenant ID.
   * @default 'tenantId'
   */
  userField?: string;
}

/**
 * Factory that returns a guard enforcing tenant-level isolation.
 *
 * Compares the tenant ID carried by the request (from a URL param, header,
 * or query param) against the tenant ID stored on the authenticated user
 * (from the JWT payload).  Returns 403 if they do not match.
 *
 * Must be used after JwtAuthGuard so that `req.user` is populated.
 *
 * @example
 * ```ts
 * // URL param: GET /orgs/:tenantId/invoices
 * @UseGuards(JwtAuthGuard, TenantGuard())
 * @Controller('/orgs/:tenantId/invoices')
 * export class InvoicesController {}
 *
 * // Header: X-Org-ID
 * @UseGuards(JwtAuthGuard, TenantGuard({ source: 'header', key: 'x-org-id' }))
 * @Controller('/invoices')
 * export class InvoicesController {}
 *
 * // Superadmins bypass tenant check:
 * @UseGuards(JwtAuthGuard, TenantGuard({ bypassRoles: ['superadmin'] }))
 * @Controller('/orgs/:tenantId/invoices')
 * export class InvoicesController {}
 * ```
 */
export function TenantGuard(
  options: TenantGuardOptions & { bypassRoles?: string[] } = {}
): Type<CanActivate> {
  const { source = 'param', key = 'tenantId', userField = 'tenantId', bypassRoles = [] } = options;

  @Injectable()
  class TenantGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest() as Record<string, unknown>;
      const ctx = context.switchToHttp().getContext() as RequestContext;
      const user = req.user as (AuthUser & Record<string, unknown>) | undefined;

      if (!user) {
        const err = Object.assign(new Error('Unauthorized'), { status: 401 });
        throw err;
      }

      // Privileged roles can bypass the tenant check entirely.
      // Still seed the context so their own queries are naturally scoped.
      if (bypassRoles.includes(user.role)) {
        const bypassTenantId = user[userField] as string | undefined;
        if (bypassTenantId) TenantContext.enterWith(bypassTenantId);
        return true;
      }

      const userTenantId = user[userField] as string | undefined;
      if (!userTenantId) {
        const err = Object.assign(
          new Error(`User is not associated with any tenant (missing "${userField}")`),
          { status: 403 }
        );
        throw err;
      }

      // Extract the request-level tenant ID from the configured source.
      let requestTenantId: string | undefined;
      switch (source) {
        case 'param':
          requestTenantId = ctx.params?.[key];
          break;
        case 'header':
          requestTenantId = ctx.headers?.[key.toLowerCase()];
          break;
        case 'query':
          requestTenantId = ctx.query?.[key];
          break;
      }

      if (!requestTenantId) {
        const err = Object.assign(new Error(`Tenant ID not found in request ${source} "${key}"`), {
          status: 400,
        });
        throw err;
      }

      if (userTenantId !== requestTenantId) {
        const err = Object.assign(
          new Error('Access denied: resource belongs to a different tenant'),
          { status: 403 }
        );
        throw err;
      }

      // Seed AsyncLocalStorage so repositories can call tenantCtx.requireId()
      // without needing tenantId passed through every function parameter.
      TenantContext.enterWith(userTenantId);

      return true;
    }
  }

  return TenantGuardMixin;
}
