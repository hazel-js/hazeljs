# Agent economy

Phase 1–3 provide budgets, wallets, and weighted allocation.  
Phase 4 adds forecasting, bidding, market clearing, and peer negotiation.

## Utility forecasting

```ts
const forecast = await organism.forecastUtility({
  agentId,
  requested: { tokens: 50_000 },
  expectedValue: 5000,
  confidence: 0.72,
});
// forecast.netExpectedValue, opportunityCost, scarcityMultiplier
```

Opportunity cost rises as the organism pool approaches exhaustion (scarcity multiplier).

## Bidding + market clearing

```ts
organism.placeBid({
  agentId,
  reason: 'Run pricing simulations',
  requested: { tokens: 100_000, money: 10 },
  expectedValue: 5000,
  confidence: 0.72,
  bidPrice: 5, // optional willingness-to-pay returned to pool
});

const result = await organism.clearMarket();
// result.awarded / result.denied ranked by net value + urgency + reputation + price
```

## Peer negotiation

```ts
await organism.negotiate({
  fromAgentId: donorId,
  toAgentId: receiverId,
  reason: 'Fund analytics burst',
  transfer: { tokens: 10_000 },
  expectedValue: 2000,
  confidence: 0.85,
});
```

## Context API

```ts
const ctx = organism.createAgentContext(agentId);
await ctx.requestResources({ reason, requested, expectedValue, useMarket: true });
ctx.placeBid({ ... });
await ctx.negotiate({ toAgentId, reason, transfer });
```

All decisions remain deterministic — no reinforcement learning in Phase 4.
