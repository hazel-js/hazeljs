# Autonomous order operations

Ecommerce shipping fallback demo for `@hazeljs/autonomous`.

## Scenario

1. Primary carrier becomes unavailable (`carrier.failed`)
2. Runtime observes impacted order
3. Decision proposes fallback carrier within policy
4. Human approval required when additional cost &gt; $2
5. Authorized `shipping.switch` executes
6. Timeline is inspectable; crash demo shows reconciliation

## Run

```bash
# From hazeljs monorepo root
npm run example:order-ops --workspace=@hazeljs/autonomous
npm run demo:failure --workspace=@hazeljs/autonomous
```

## Policies (fixtures)

- `maximumAdditionalShippingCost`: 5
- `allowedFallbackCarriers`: carrier-b, carrier-c
- `requireApprovalWhen.additionalCostGreaterThan`: 2

All carriers and orders are fixtures — no live providers.
