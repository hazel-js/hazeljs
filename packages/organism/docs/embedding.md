# Embedding Organism in product platforms

Use `@hazeljs/organism` as the agentic runtime. Do **not** reimplement need detection, spawn/reuse, survival, or simulation in your product layer.

## Recommended entry points

```ts
import {
  createOpsOrganism,
  createOrganismHost,
  toEnvironmentSignal,
  toIncidentEnvironmentSignal,
  toAgentOutcomeReport,
} from '@hazeljs/organism';

const host = await createOpsOrganism({
  mission: {
    id: 'commerce-ops',
    objective: 'Keep commerce healthy within policy',
  },
  genes: [
    { id: 'commerce-generalist', capabilities: ['commerce', 'operations'] },
    { id: 'refund-analysis', capabilities: ['analytics', 'commerce'] },
  ],
  constitution: {
    id: 'commerce',
    rules: [
      {
        id: 'pii',
        rule: 'Never expose customer personally identifiable information',
        severity: 'critical',
      },
    ],
  },
  signalNeedMappings: [
    {
      signalType: 'refunds.increased',
      need: 'refund-analysis',
      requiredCapabilities: ['analytics', 'commerce'],
      urgency: 0.9,
      confidence: 0.9,
    },
  ],
  incidentTypes: ['refund_spike', 'product_issue'],
  limits: { maxAgents: 15, maxTotalCostPerHour: 10 },
  simulation: false,
});

await host.start();

// External/product signal → organism (strip tenancy first)
await host.observe(
  toEnvironmentSignal({
    type: 'refund.created',
    source: 'woocommerce',
    severity: 0.7,
    data: { orderId: '123' },
  })
);

// After your outer incident detector opens an incident:
await host.observe(
  toIncidentEnvironmentSignal({
    incidentType: 'product_issue',
    severity: 0.85,
    data: { incidentId: 'inc_1' },
  })
);

const state = await host.inspect();
```

## Boundary rules

| Belongs in `@hazeljs/organism` | Belongs in the product (e.g. Zynli) |
|--------------------------------|-------------------------------------|
| Mission, genes, need detection | Vertical incident detectors |
| Spawn / reuse / specialize | Semantic action catalogs |
| Constitution enforcement | Business policy / approvals |
| Utility, reputation, survival | Tenancy (`tenantId`, `businessId`) |
| `simulate()` | Integration adapters (Woo, PMS) |
| `OrganismRepository` | Product DB for incidents/approvals |

## Persistence

Inject `OrganismRepository` via `createOrganism` / `createOpsOrganism({ repository })`.  
`InMemoryOrganismRepository` is built-in for tests and demos. Production apps implement the interface against their database.

Use `OrganismHostRegistry` to reuse live hosts by id instead of keeping a parallel `Map` in the product layer:

```ts
import { OrganismHostRegistry, createOpsOrganism } from '@hazeljs/organism';

const registry = new OrganismHostRegistry();
const host = await registry.getOrCreate(existingId, () =>
  createOpsOrganism({ /* ... */, repository })
);
```

## Simulation

```ts
await host.simulate({
  duration: '7d',
  signals: [
    { type: 'room.not_ready', source: 'pms', severity: 0.8, data: {} },
  ],
});
```

Simulation runs the full organism lifecycle without requiring you to rebuild clock/signal injection.
