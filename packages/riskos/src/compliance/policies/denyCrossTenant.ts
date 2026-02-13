/**
 * Deny cross-tenant data retrieval
 */

import type { Policy, PolicyContext, PolicyResult } from '../policyEngine';
import type { HazelEvent } from '@hazeljs/contracts';

function getEventTenantId(event: HazelEvent): string | undefined {
  const payload = (event as unknown as Record<string, unknown>).payload as
    | Record<string, unknown>
    | undefined;
  if (payload?.tenantId) return String(payload.tenantId);
  const da = event as { dataset?: string; tenantId?: string };
  if ('tenantId' in da) return da.tenantId;
  return undefined;
}

export function denyCrossTenant(): Policy {
  return {
    name: 'denyCrossTenant',
    phase: 'onEvent',
    evaluate(ctx: PolicyContext & { event: HazelEvent }): PolicyResult {
      const eventTenant = getEventTenantId(ctx.event);
      if (!eventTenant || !ctx.tenantId) return { policy: 'denyCrossTenant', result: 'ALLOW' };
      if (eventTenant !== ctx.tenantId) {
        return {
          policy: 'denyCrossTenant',
          result: 'DENY',
          message: 'Cross-tenant access denied',
        };
      }
      return { policy: 'denyCrossTenant', result: 'ALLOW' };
    },
  };
}
