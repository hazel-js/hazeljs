# Production security checklist

- [ ] `mode: 'enforce'` and `defaultDecision: 'deny'`
- [ ] Trusted identity (`agentId`, `tenantId`, `environment`, `delegatedUserId`) comes from runtime context, not tool args
- [ ] Tenant fields in input validated with `enforceTenantField`
- [ ] Destructive tools denied in production unless explicitly allowed
- [ ] Amount / rate / cost / invocation budgets set for sensitive tools
- [ ] Approval required for irreversible or high-value actions
- [ ] Input and output Zod schemas on protected tools
- [ ] Redaction metadata on secrets; audit sink never logs raw secrets
- [ ] Shared `auditSink` (Kafka / OTEL / log shipper) — not `InMemoryAuditSink`
- [ ] Shared `approvalProvider` (`createRedisApprovalProvider` or durable HITL) when running more than one process
- [ ] `audit.critical: true` (default in enforce) so audit failure fails closed
- [ ] No silent fallback to audit mode
- [ ] MCP invoke wrapped with `protectMcpInvoke` if tools are exposed over MCP
- [ ] `hazel gatekeeper validate` in CI

**Unsafe:** `mode: 'audit'` and `mode: 'disabled'` are not production enforcement.
