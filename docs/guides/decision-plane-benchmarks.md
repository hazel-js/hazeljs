# Decision Plane benchmark limits

Offline routing dataset: [`packages/decision/benchmarks/routing-v1.json`](../../packages/decision/benchmarks/routing-v1.json).

```bash
npx ts-node packages/decision/benchmarks/run-routing-bench.ts
```

## What the report includes

- Sample size
- Accuracy with Wilson score interval
- Escalation rate
- Prohibited-action attempt count (labeled cases)
- Simulated cost per success (baseline vs routed)
- Simulated latency totals

## Limits (read before citing)

- Costs and latencies are **simulated** and labeled as such. They are not live provider bills.
- No competitor savings figures are produced or claimed.
- Dataset covers routine, ambiguous, malicious, and consequential cases for the **rules** model-route integration — not production traffic.
- Agent VM `BranchScorer` is out of this slice.
- Live OpenAI Agents / Decisions API runs are unavailable or opt-in and are not part of this offline bench.
