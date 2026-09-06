# Mission

A mission is the top-level objective.

```ts
@Mission({
  id: 'revenue-growth',
  objective: 'Increase ecommerce gross profit by 20%',
  horizon: '90d',
  successCriteria: [
    { name: 'gross_profit', operator: 'maximize' },
    { name: 'refund_rate', operator: 'lte', target: 0.05 },
    { name: 'csat', operator: 'gte', target: 90 },
  ],
})
export class RevenueMission {}
```

Progress updates via `reportOutcome(..., { missionMetricUpdates })`. Target operators (`gt`/`gte`/`lt`/`lte`/`eq`) drive completion; `maximize`/`minimize` are tracked but do not auto-complete alone.
