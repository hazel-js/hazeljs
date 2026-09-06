# Simulation

```ts
await organism.simulate({
  duration: '30d',
  environment: { clock: 'accelerated' },
  signals: [{ type: 'refunds.increased', source: 'sim', severity: 0.9 }],
});
```

Accelerated clock drives cycles. Demo tools are in-process mocks — no irreversible external actions.
