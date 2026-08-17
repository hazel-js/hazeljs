# Architecture

HazelJS Agent Gatekeeper is the runtime authorization and policy-enforcement layer that controls every tool action attempted by an agent.

## Boundaries

| Layer                             | Owns                                                          | Does not own                                      |
| --------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| Agent DNA                         | Identity, declared tools, capabilities, portable policies     | Tool handlers, environment placement              |
| Skillgate                         | Which REST ops become tools; default HITL/risk classification | Per-invocation authorization                      |
| Agent Gatekeeper                  | Whether **this** agent may call **this** tool **now**         | Durable run storage, LLM loop, MCP transport auth |
| Durable Kernel (`@hazeljs/agent`) | Steps, checkpoints, HITL resume, recovery                     | Policy language                                   |
| Control Plane                     | Desired state, admission, reconcile                           | Per-tool-call decisions                           |

Gatekeeper sits immediately before protected tool execution. It enforces the intersection of what DNA declares, what Skillgate exposes, and what runtime policy permits.

## Trusted context

Identity, tenant, environment, and delegation come only from `ToolInvocationContext` supplied by the runtime. Model-generated tool arguments are untrusted input.

If a tool argument includes `tenantId`, validate it against the trusted runtime tenant (`rules.enforceTenantField`).

## Decision flow

1. Structural input validation when a schema is present (again after rewrite).
2. Deterministic policy match + precedence: explicit deny → require approval → rewrite/constrain → explicit allow → default decision.
3. At most one rewrite pass; a second rewrite is `GATEKEEPER_REWRITE_LIMIT`.
4. Approval consume is scoped to an invocation fingerprint. Argument changes invalidate prior approval.
5. Optional output schema + field redaction before returning to the agent.
6. Structured audit events without raw secrets.

## Relation to PolicyEngine

`@hazeljs/agent` `PolicyEngine` remains for backward compatibility and **defaults to allow**. Gatekeeper **defaults to deny** in enforce mode. Use `policiesFromPolicyRules` to adapt existing rules. When `authorizationGate` is set on `ToolExecutor`, PolicyEngine is skipped for that call to avoid double evaluation.
