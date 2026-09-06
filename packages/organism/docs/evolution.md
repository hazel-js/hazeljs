# Evolution

Competing agent strategies can be scored and promoted without rewriting executable source.

## Mutation (constrained)

Safe mutable surfaces only:

- system prompt appendices (`promptChanges`)
- capabilities add/remove
- `modelConfig` / `strategyConfig`

```ts
await organism.mutateAgent(agentId, {
  reason: 'Try decompose-first planning',
  mutation: {
    strategyConfig: { planning: 'decompose-first' },
    modelConfig: { temperature: 0.2 },
    promptChanges: ['Prefer stepwise plans'],
  },
});
```

Every mutation is auditable on `agent.mutations[]` and emits `organism.agent.mutated`.

Gene may disable mutation or restrict allowed properties via `mutation.allowedProperties`.

## Generation evaluation

```ts
const result = await organism.evaluateGeneration({
  population: ['pricing-v1', 'pricing-v2', 'pricing-v3'],
  populationId: 'pricing',
  promoteToLosers: true, // optional: copy winner strategy into losers via mutation
});
// { winner, scores, promotedStrategyId }
```

Scoring uses the same configurable utility weights as the economy layer (mission contribution, reliability, efficiency, policy compliance, collaboration).

History: `organism.getEvolutionaryHistory()`.
