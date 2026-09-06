# Introduction

In conventional multi-agent systems, developers define the organization.

In HazelJS Agentic Organisms, developers define the **mission** and **operating boundaries**. The organization can emerge dynamically at runtime.

```ts
import { createOrganism } from '@hazeljs/organism';

const organism = await createOrganism({
  mission: { id: 'ops', objective: 'Operate support profitably' },
  genes: [{ id: 'support', capabilities: ['customer-support'] }],
  limits: {
    maxAgents: 10,
    maxGenerationDepth: 3,
    maxChildrenPerAgent: 3,
    maxSpawnRatePerMinute: 5,
    maxTotalCostPerHour: 10,
  },
});

await organism.start();
```

See [mental-model.md](./mental-model.md) and [architecture.md](./architecture.md).
