# @hazeljs/skillgate

**Turn selected HazelJS REST endpoints into governed agent skills.**

Reads by default. Writes need approval. Agent OS runs the think loop. Skillgate is **not** a magic “learn every API” brain — it is a **gate**: allowlist / tags / `x-hazel-skill`, classify, harden, register.

[![npm version](https://img.shields.io/npm/v/@hazeljs/skillgate.svg)](https://www.npmjs.com/package/@hazeljs/skillgate)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/skillgate)](https://www.npmjs.com/package/@hazeljs/skillgate)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Opt-in curation** — only operations with tag `agent` / `skillgate`, `x-hazel-skill`, or an explicit allowlist
- **Safe defaults** — reads are read-only; writes require approval; DELETE and admin paths denied unless opted in
- **OpenAPI + decorators** — `fromOpenApi`, `fromModule`, and `@AgentSkill`
- **Agent OS ready** — register into `@hazeljs/agent` `ToolRegistry` / `AgentRuntime`
- **Optional MCP export** — `toMcpServer()` for Cursor / Claude Desktop
- **CLI** — `hazel skillgate from-openapi` and `hazel skillgate init`

## Installation

```bash
npm install @hazeljs/skillgate @hazeljs/agent
```

## Quick Start

```typescript
import { Skillgate } from '@hazeljs/skillgate';
import { ToolRegistry } from '@hazeljs/agent';

const gate = Skillgate.fromOpenApi(spec, {
  include: { tags: ['agent'], operationIds: ['getOrder', 'createTicket'] },
  classify: { writeRequiresApproval: true },
  invoke: {
    baseUrl: 'http://127.0.0.1:3000',
    headers: { Authorization: 'Bearer ${API_TOKEN}' },
  },
});

const registry = new ToolRegistry();
gate.register(registry, 'api-concierge');

console.log(gate.report());
// → included skills + denied destructive/admin + warnings
```

## OpenAPI extension

```yaml
paths:
  /orders/{id}:
    get:
      operationId: getOrder
      tags: [agent]
      summary: Fetch an order by id
      x-hazel-skill:
        readOnly: true
  /refunds:
    post:
      operationId: createRefund
      x-hazel-skill:
        requiresApproval: true
```

## Decorator

```typescript
import { AgentSkill } from '@hazeljs/skillgate';

class OrdersController {
  @AgentSkill({ description: 'Fetch an order by id', readOnly: true })
  getOrder() {}

  @AgentSkill({ requiresApproval: true })
  createRefund() {}
}
```

Use `toXHazelSkill(getAgentSkillMetadata(...))` when generating OpenAPI (`x-hazel-skill`).

## fromModule + MCP

```typescript
const gate = Skillgate.fromModule(AppModule, {
  swagger: { title: 'API', servers: [{ url: 'http://127.0.0.1:3000' }] },
  invoke: { baseUrl: 'http://127.0.0.1:3000' },
});

// Optional MCP export for Cursor / Claude Desktop
const server = gate.toMcpServer({ name: 'hazel-api-skills', version: '1.0.0' });
server.listenStdio();
```

## Safety defaults

| Class                                   | Default                                          |
| --------------------------------------- | ------------------------------------------------ |
| GET / HEAD                              | `readOnly`, no approval                          |
| POST / PUT / PATCH                      | `requiresApproval: true`                         |
| DELETE                                  | **denied** unless `classify.allowDestructive`    |
| `/admin`, `/internal`, `/debug`, health | **denied** unless `classify.allowAdmin`          |
| Tool count                              | warn > 12, fail > 24 (`force: true` to override) |

## CLI

```bash
hazel skillgate from-openapi ./openapi.json
hazel skillgate init
```

## Related

- `@hazeljs/agent` — `openApiToSkills`, `createSkillInvoker`, AgentRuntime
- `@hazeljs/swagger` — OpenAPI from controllers
- `@hazeljs/mcp` — export ToolRegistry to MCP
- [SKILLGATE_PLAN.md](https://github.com/hazel-js/hazeljs) — product plan

## License

Apache-2.0
