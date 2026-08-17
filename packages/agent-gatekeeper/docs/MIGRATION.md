# Migration / adoption

Adopt Gatekeeper incrementally. Do not break existing agent or tool APIs.

## Phase 1 — wrap tools

Protect sensitive functions without changing AgentRuntime:

```ts
await gatekeeper.execute({ context, tool: fromFunction('stripe.refund', refundFn) });
```

## Phase 2 — optional ToolExecutor hook

```ts
new AgentRuntime({
  authorizationGate: createToolExecutorGate(gatekeeper, contextFactory),
});
```

Existing PolicyEngine / PolicyService path remains when `authorizationGate` is unset.

## Phase 3 — MCP

Keep default MCP invoke. Wrap with `protectMcpInvoke` where application-level authz is required.

## Phase 4 — DNA policies

Store Gatekeeper policies in DNA `policies` and load with `policiesFromDna`. Leave the DNA type as `unknown[]`.

## Not in this release

Mandatory enforcement inside Agent OS, replacing PolicyEngine, changing MCP default invoke, Cedar/OPA, signed DNA, Control Plane policy UI.
