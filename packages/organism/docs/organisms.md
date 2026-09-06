# Organisms

```ts
const organism = await createOrganism({ mission, genes, constitution, environment, resources });
await organism.start();
await organism.pause();
await organism.resume();
await organism.terminate();
await organism.emergencyStop();
```

`inspect()` and `getGraph()` expose state for tooling / Dev Studio.
