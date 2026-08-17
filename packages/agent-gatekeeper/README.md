# @hazeljs/agent-gatekeeper

**Every tool call authorized before execution.**

HazelJS Agent Gatekeeper is the runtime authorization and policy-enforcement layer that controls every tool action attempted by an agent.

An agent may propose a tool invocation. It must not directly execute a protected tool. Gatekeeper evaluates agent identity, tenant, delegated user, tool, arguments, runtime context, limits, and applicable policies before allowing execution.

This is not a prompt guardrail. It is a deterministic runtime authorization boundary.

[![npm version](https://img.shields.io/npm/v/@hazeljs/agent-gatekeeper.svg)](https://www.npmjs.com/package/@hazeljs/agent-gatekeeper)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Default deny** in enforce mode when no applicable allow policy exists
- **Deterministic policies** independent of the LLM
- **Allow / deny / require approval / rewrite** decisions with bounded rewrite revalidation
- **Trusted identity** from runtime context — never from model-generated tool arguments
- **Adapters** for plain functions, HazelJS tools, Skillgate skills, and MCP calls
- **Pluggable approvals and audit** — no coupling to one UI or database
- **CLI** — `hazel gatekeeper validate | simulate | explain` (never executes tools)

## Installation

```bash
npm install @hazeljs/agent-gatekeeper
```

## Quick Start

```typescript
import { AgentGatekeeper, fromFunction, InMemoryAuditSink } from '@hazeljs/agent-gatekeeper';

const refundPolicy = {
  id: 'refund-agent-stripe-policy',
  version: '1.0.0',
  priority: 100,
  match: {
    agents: ['refund-agent'],
    tools: ['stripe.refund'],
    environments: ['production'],
  },
  rules: {
    allowWhen: ({ input, context }) => input.amount <= 100 && input.tenantId === context.tenantId,
    requireApprovalWhen: ({ input }) => input.amount > 50,
  },
};

const gatekeeper = new AgentGatekeeper({
  mode: 'enforce',
  defaultDecision: 'deny',
  policies: [refundPolicy],
  auditSink: new InMemoryAuditSink(),
});

const tool = fromFunction('stripe.refund', async (input) => ({ refunded: input.amount }), {
  classification: 'write',
});

const result = await gatekeeper.execute({
  context: {
    invocationId: 'inv-1',
    runId: 'run-1',
    agentId: 'refund-agent',
    tenantId: 'tenant-a',
    toolName: 'stripe.refund',
    input: { amount: 40, tenantId: 'tenant-a' },
    environment: 'production',
    timestamp: new Date(),
  },
  tool,
});
```

Evaluate without execution:

```typescript
const decision = await gatekeeper.evaluate(context);
const explanation = await gatekeeper.simulate(context); // never executes, never creates approvals
```

## Operating modes

| Mode       | Behavior                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `enforce`  | Decisions applied. Default deny. Fail-closed on policy/approval/critical audit failure. **Use in production.**                          |
| `audit`    | Evaluates and emits what would happen, then allows execution unless structural validation fails. **Unsafe for production enforcement.** |
| `disabled` | Bypasses policy evaluation while preserving minimal observability.                                                                      |

Mode selection is explicit. Gatekeeper never silently falls back from `enforce` to `audit`.

## Architecture

- **Agent DNA** declares identity, capabilities, permissions, trust level, and operating limits.
- **Skillgate** exposes APIs and tools as governed agent capabilities.
- **Agent Gatekeeper** evaluates whether a specific agent may make a specific tool call in the current context.
- **Durable Kernel** (`@hazeljs/agent` AgentRuntime) executes durable work and records/retries/recovers runs.
- **Control Plane** manages policies, deployments, approvals, and observability at the resource level — not per-call authz.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## CLI

```bash
hazel gatekeeper validate --config agent-gatekeeper.yaml
hazel gatekeeper simulate --agent refund-agent --tool stripe.refund --input input.json
hazel gatekeeper explain --invocation invocation.json
```

These commands never execute tools.

## Incremental adoption

Wrap existing tools with `fromFunction` / `fromHazelTool` / `fromSkillgate` / `protectMcpInvoke`. Optionally pass `authorizationGate` to `AgentRuntime` / `ToolExecutor` via `createToolExecutorGate`. Existing PolicyEngine paths stay unchanged when the gate is unset.

Mandatory Agent OS enforcement is **not** enabled in this release.

## Related

- [Policy authoring](docs/POLICY.md)
- [Human approval](docs/APPROVAL.md)
- [Adapters](docs/ADAPTERS.md)
- [Production checklist](docs/SECURITY.md)
- [Migration](docs/MIGRATION.md)
- [@hazeljs/skillgate](https://hazeljs.ai/docs/packages/skillgate)
- [@hazeljs/agent](https://hazeljs.ai/docs/packages/agent)

## License

Apache-2.0
