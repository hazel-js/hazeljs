# Reproduction

Agents can create specialized descendants with an explicit inheritance policy.

```ts
const child = await organism.reproduceAgent(parentId, {
  reason: 'Need Swedish VAT expertise',
  specialization: ['swedish-tax', 'vat'],
  inheritance: {
    mission: true,
    constitution: true,
    permissions: 'subset', // never escalate beyond parent
    memory: { strategy: 'relevant-only', maxItems: 100 },
    resources: { transferFraction: 0.25 },
  },
});
```

From agent context:

```ts
const ctx = organism.createAgentContext(parentId);
await ctx.reproduce({ reason: '...', specialization: ['sizing'] });
```

## Rules

- Gene may disable reproduction (`reproduction.enabled: false`)
- `maxGenerationDepth` and `maxChildrenPerAgent` (and gene `maxChildren`) are enforced
- Reproduction cooldown is configurable (`reproduction.cooldownMs`)
- Child **capabilities** may grow via specialization
- Child **permissions** are always ⊆ parent permissions
- Genealogy is updated and printable via `formatGenealogy()`
