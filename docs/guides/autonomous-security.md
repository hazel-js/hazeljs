# Autonomous runtime security

## Default deny

A capability executes only when all of the following hold server-side:

1. Capability is registered
2. Service grants include the capability id
3. Gatekeeper policy allows (or approval consumed)
4. Tenant context is trusted (framework identity)
5. Budgets / rate limits permit
6. Effect / simulation barriers permit

Model-produced permission claims are ignored.

## Approvals

Approvals bind capability id, argument digest, tenant, and expiry. Argument changes invalidate prior approval (`argumentsHash` / Gatekeeper fingerprint).

## Tenant isolation

`resolveTenantId` (or trusted request context) overrides any `tenantId` inside observation payloads.

## Dry-run / simulation

`simulation: true` and dry-run replay never invoke live capability side effects.

## Secrets

Observation payloads are redacted before timeline/audit persistence by default (`redactPayload`).
