# Adapters

Gatekeeper is provider-neutral. Wrap tools; do not duplicate MCP transport authorization.

## Plain functions

```ts
import { fromFunction } from '@hazeljs/agent-gatekeeper';

const tool = fromFunction('db.query', async (input) => runQuery(input), {
  classification: 'read',
  inputSchema: z.object({ sql: z.string() }),
});
```

## HazelJS / Skillgate

```ts
import { fromHazelTool, fromSkillgate, createToolExecutorGate } from '@hazeljs/agent-gatekeeper';

const protectedTool = fromHazelTool(toolMetadata);
const skill = fromSkillgate(governedSkill, invoker);

runtime = new AgentRuntime({
  authorizationGate: createToolExecutorGate(gatekeeper),
});
```

When `authorizationGate` is set, `ToolExecutor` skips PolicyEngine for that call.

## MCP

Default `HazelToolAdapter.invoke` **bypasses** ToolExecutor (policy/HITL). Do not change that default. Opt in:

```ts
import { protectMcpInvoke } from '@hazeljs/agent-gatekeeper';

const invoke = protectMcpInvoke(adapter.invoke.bind(adapter), gatekeeper, contextFactory);
```

This is application-level authorization (tenant, permissions, argument limits, approvals), not MCP transport auth.
