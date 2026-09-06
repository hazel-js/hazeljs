# Agent genes

A gene is a reusable capability template. It is **not** Agent DNA.

Birth compiles gene + specialization → `AgentDna` → `createAgentClassFromDna` → `AgentRuntime.registerAgent`.

```ts
@AgentGene({
  id: 'commerce-generalist',
  capabilities: ['research', 'commerce', 'customer-support'],
  reproduction: { enabled: true },
  mutation: { enabled: true },
})
export class CommerceGene {}
```
