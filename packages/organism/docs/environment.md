# Environment

```ts
await organism.observe({
  type: 'refunds.increased',
  source: 'analytics',
  severity: 0.9,
  data: { baseline: 0.04, current: 0.071 },
});
```

Signals are normalized, relevance-filtered, then mapped to needs via `signalNeedMappings`.

Domain-specific routing (ecommerce refunds, support spikes, etc.) belongs in those mappings — not in the core detector. Unmapped anomaly signals only derive generic capability hints from the signal type subject tokens (e.g. `orders.delay` → `['orders']`).
