# Policy authoring

Policies are typed TypeScript objects (`AgentGatekeeperPolicy`). YAML (`agent-gatekeeper.yaml`) covers declarative matchers, limits, and redaction. JavaScript predicates remain TypeScript-only.

## Shape

```ts
const policy: AgentGatekeeperPolicy = {
  id: 'refund-agent-stripe-policy',
  version: '1.0.0',
  priority: 100,
  match: {
    agents: ['refund-agent'],
    tools: ['stripe.refund'],
    environments: ['production'],
  },
  rules: {
    allowWhen: ({ input, context }) => input.amount <= 100 && input.tenantId === context.tenantId,
    requireApprovalWhen: ({ input }) => input.amount > 50,
  },
};
```

## Precedence

1. Explicit deny
2. Require approval
3. Rewrite / constrain
4. Explicit allow
5. Default decision (`deny` recommended in production)

Same priority: deny wins, then approval, then rewrite, then allow. Sort is `priority` descending, then `id`.

## Matchers

- Agent id, version, roles, trust level
- Tenant and delegated user
- Exact tool names and safe wildcards (`stripe.*`, `*`)
- Environment, tool classification (`read` | `write` | `destructive`)
- UTC time windows

## YAML

```yaml
mode: enforce
defaultDecision: deny
policies:
  - id: refund-policy
    version: '1.0.0'
    priority: 100
    match:
      agents: [refund-agent]
      tools: [stripe.refund]
      environments: [production]
    rules:
      maxTransactionAmount: 100
      enforceTenantField: tenantId
      requireApprovalWhenFieldGt:
        - field: amount
          threshold: 50
```

Load with `loadPoliciesFromYaml` / `loadPoliciesFromFileSync`. Validate with `hazel gatekeeper validate`.

## Bridging existing PolicyEngine rules

```ts
import { policiesFromPolicyRules } from '@hazeljs/agent-gatekeeper';

const policies = policiesFromPolicyRules(existingPolicyEngineRules);
```

DNA: `policiesFromDna(dna)` accepts Gatekeeper-shaped objects or legacy `PolicyRule` objects. DNA `policies?: unknown[]` is unchanged.
