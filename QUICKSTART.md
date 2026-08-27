# HazelJS Quick Start

**Agent OS for TypeScript backends.** Durable agents in the same DI/HTTP app as your APIs.

Do **not** add `reflect-metadata` to your app. `@hazeljs/core` installs and loads it.

## Option 1: Meridian (recommended)

The flagship teaching app for DNA, Store, Skillgate, HITL, and local apply.

```bash
git clone https://github.com/hazel-js/hazeljs-meridian-ops.git
cd hazeljs-meridian-ops
npm install
npm run store:sync      # DNA packages + lockfile
npm run platform:sync   # Apply Definitions / Deployments (does not restart Node)
npm run dev
```

Docs: [Agent OS](https://hazeljs.ai/agent-os) · [Agent OS guide](https://hazeljs.ai/docs/guides/agent-os) · [Skillgate](https://hazeljs.ai/docs/guides/skillgate)

## Option 2: Agent OS scaffold

Smaller than Meridian. DNA + HITL templates — not an HTTP/HCEL demo.

```bash
npx @hazeljs/cli agent new my-desk --template=agent-os
# templates: bare | agent-os | skillgate
cd my-desk && npm install && npm run dev
```

## Option 3: HTTP + HCEL / RAG scaffold

Useful for framework onboarding. **Not** a substitute for Meridian if you need DNA / Store / Skillgate / HITL.

```bash
npx @hazeljs/cli g app my-app --template=ai-native
cd my-app
npm install
cp .env.example .env
docker-compose up -d
npm run dev
```

Skeleton API only: `npx @hazeljs/cli g app my-app`

## Option 4: One file (HTTP / DI)

```bash
npm install @hazeljs/core
```

```typescript
import { HazelApp, HazelModule, Controller, Get } from '@hazeljs/core';

@Controller({ path: '/hello' })
class HelloController {
  @Get()
  hello() {
    return { message: 'Hello, World!' };
  }
}

@HazelModule({
  controllers: [HelloController],
})
class AppModule {}

async function bootstrap() {
  const app = new HazelApp(AppModule);
  await app.listen(3000);
}

bootstrap();
```

`tsconfig.json` needs `"experimentalDecorators": true`. You do not need to import `reflect-metadata`.

## Agent OS in 30 seconds

```typescript
import { Agent, Tool } from '@hazeljs/agent';

@Agent({
  name: 'support-agent',
  systemPrompt: 'You are a helpful customer support agent.',
})
export class SupportAgent {
  @Tool({
    description: 'Look up order by ID',
    parameters: [{ name: 'orderId', type: 'string', required: true }],
  })
  async lookupOrder(input: { orderId: string }) {
    return { status: 'shipped' };
  }

  @Tool({
    description: 'Process a refund',
    requiresApproval: true,
    parameters: [{ name: 'orderId', type: 'string' }],
  })
  async processRefund(input: { orderId: string }) {
    return { success: true };
  }
}
```

Then: Skillgate for OpenAPI skills, Gatekeeper for fail-closed auth, Agent VM for reversible tools, `describeAgent` for CI. See the [root README](./README.md).

## TypeScript

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "experimentalDecorators": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

`emitDecoratorMetadata` is optional for most HazelJS apps. Do not install or import `reflect-metadata`.

## Next steps

- [Documentation](https://hazeljs.ai/docs)
- [Agent OS guide](https://hazeljs.ai/docs/guides/agent-os)
- [Meridian](https://github.com/hazel-js/hazeljs-meridian-ops)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Contributing](./CONTRIBUTING.md)

## Support

- Issues: [github.com/hazel-js/hazeljs/issues](https://github.com/hazel-js/hazeljs/issues)
- Discussions: [github.com/hazel-js/hazeljs/discussions](https://github.com/hazel-js/hazeljs/discussions)
- Discord: [discord.gg/PxNBPzvQk7](https://discord.gg/PxNBPzvQk7)
