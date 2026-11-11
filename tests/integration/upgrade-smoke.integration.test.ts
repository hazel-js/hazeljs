/**
 * Upgrade smoke suite — catches Zod 4 / OTEL / flow-runtime regressions
 * that package unit tests alone do not cover.
 *
 * Run after `npm run build` (CI does). Prefer dist imports for ESM .js paths.
 */
import 'reflect-metadata';
import { z } from 'zod';
import { AgentToolRegistry } from '../../packages/ai/dist/tools/tool-registry';
import { AgentTool } from '../../packages/ai/dist/tools/agent-tool.decorator';
import {
  AgentGatekeeper,
  GatekeeperValidationError,
  InMemoryAuditSink,
  fromFunction,
} from '../../packages/agent-gatekeeper/dist';
import type { ToolInvocationContext } from '../../packages/agent-gatekeeper/dist';
import {
  createStructuredPlaneProvider,
  defineDecision,
} from '../../packages/decision/dist';
import type { StructuredObjectGenerator } from '../../packages/decision/dist';
import { OpenTelemetryProvider } from '../../packages/observability/dist';
import { flow } from '../../packages/flow/dist';
// Import leaf modules — barrel index pulls recovery → ESM-only p-limit (breaks Jest CJS).
import { createFlowEngine } from '../../packages/flow-runtime/dist/engine';
import { runUntilSettled } from '../../packages/flow-runtime/dist/run-until-settled';

function makeContext<TInput = Record<string, unknown>>(
  overrides: Partial<ToolInvocationContext<TInput>> & { input?: TInput } = {}
): ToolInvocationContext<TInput> {
  return {
    invocationId: 'inv-upgrade-smoke',
    runId: 'run-upgrade-smoke',
    agentId: 'smoke-agent',
    tenantId: 'tenant-smoke',
    toolName: 'orders.lookup',
    input: {} as TInput,
    environment: 'test',
    timestamp: new Date('2026-11-11T00:00:00Z'),
    ...overrides,
  };
}

describe('upgrade smoke — Zod 4 schema round-trip (ai → gatekeeper)', () => {
  const orderSchema = z
    .object({
      orderId: z.string().min(1),
      amount: z.number().positive(),
    })
    .strict();

  type OrderInput = z.infer<typeof orderSchema>;

  it('converts tool schemas to OpenAPI-shaped JSON Schema via z.toJSONSchema', () => {
    class OrderTools {
      async lookup(input: OrderInput): Promise<{ ok: true; orderId: string }> {
        return { ok: true, orderId: input.orderId };
      }
    }

    // Apply classic MethodDecorator explicitly (3-arg) so this file typechecks
    // under both experimentalDecorators and Stage-3-default IDE projects.
    const descriptor = Object.getOwnPropertyDescriptor(OrderTools.prototype, 'lookup');
    if (!descriptor) {
      throw new Error('expected lookup method descriptor');
    }
    AgentTool({
      name: 'orders.lookup',
      description: 'Look up an order',
      inputSchema: orderSchema,
    })(OrderTools.prototype, 'lookup', descriptor);

    const registry = new AgentToolRegistry();
    registry.registerTools(new OrderTools());
    const [fn] = registry.toAIFunctions(['orders.lookup']);

    expect(fn.name).toBe('orders.lookup');
    expect(fn.parameters.type).toBe('object');
    expect(fn.parameters.properties.orderId?.type).toBe('string');
    expect(fn.parameters.properties.amount?.type).toBe('number');
    expect(fn.parameters.required).toEqual(expect.arrayContaining(['orderId', 'amount']));
  });

  it('gatekeeper validates Zod 4 input schemas (allow + reject)', async () => {
    const tool = fromFunction(
      'orders.lookup',
      async (input: OrderInput) => ({ ok: true as const, orderId: input.orderId }),
      { classification: 'read', inputSchema: orderSchema }
    );
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      auditSink: new InMemoryAuditSink(),
    });

    const allowed = await gk.execute({
      context: makeContext<OrderInput>({
        toolName: 'orders.lookup',
        input: { orderId: 'ord_1', amount: 12.5 },
      }),
      tool,
    });
    expect(allowed.output).toEqual({ ok: true, orderId: 'ord_1' });

    await expect(
      gk.execute({
        context: makeContext<OrderInput>({
          toolName: 'orders.lookup',
          input: { orderId: 'ord_1', amount: -1 },
        }),
        tool,
      })
    ).rejects.toThrow(GatekeeperValidationError);
  });
});

describe('upgrade smoke — Decision plane Zod 4 structured answers', () => {
  it('accepts valid structured answers and rejects invalid ones', async () => {
    const definition = defineDecision({
      id: 'refund.approve',
      version: '1.0.0',
      description: 'Approve or deny a refund',
      answers: ['approve', 'deny'] as const,
      criteria: {
        approve: 'Refund is valid',
        deny: 'Refund should be denied',
      },
    });

    const generator: StructuredObjectGenerator = {
      async generateObject(_prompt, _schema) {
        return { answer: 'approve', summary: 'Looks good', confidence: 0.91 };
      },
    };

    const provider = createStructuredPlaneProvider({ generator, name: 'smoke-structured' });
    const ok = await provider.decide({
      definition,
      context: { amount: 20 },
    });
    expect(ok.kind).toBe('answer');
    if (ok.kind === 'answer') {
      expect(ok.answer).toBe('approve');
      expect(ok.confidence).toBe(0.91);
    }

    const badGenerator: StructuredObjectGenerator = {
      async generateObject() {
        return { answer: 'maybe', summary: 'not allowed' };
      },
    };
    const badProvider = createStructuredPlaneProvider({
      generator: badGenerator,
      name: 'smoke-structured-bad',
    });
    const invalid = await badProvider.decide({
      definition,
      context: {},
    });
    expect(invalid.kind).toBe('invalid');
  });
});

describe('upgrade smoke — OpenTelemetry provider (unmocked)', () => {
  it('starts and stops a real NodeTracerProvider without OTLP endpoint', async () => {
    const provider = new OpenTelemetryProvider({
      serviceName: 'hazeljs-upgrade-smoke',
    });

    await expect(provider.start()).resolves.toBeUndefined();
    const tracer = provider.getTracer('upgrade-smoke');
    expect(typeof tracer.startSpan).toBe('function');

    const span = tracer.startSpan('smoke-span');
    span.setAttribute('smoke', true);
    span.end();

    provider.trackCost('gpt-test', 3, 5);
    await expect(provider.stop()).resolves.toBeUndefined();
  });
});

describe('upgrade smoke — flow ↔ flow-runtime', () => {
  it('runs a linear flow to completion via createFlowEngine + runUntilSettled', async () => {
    const def = flow('upgrade-smoke-flow', '1.0.0')
      .entry('a')
      .node('a', async () => ({ status: 'ok' as const, output: 1, patch: { x: 1 } }))
      .edge('a', 'b')
      .node('b', async (ctx) => ({
        status: 'ok' as const,
        output: (ctx.state.x as number) + 1,
      }))
      .build();

    const engine = await createFlowEngine();
    await engine.registerDefinition(def);

    const { runId } = await engine.startRun({
      flowId: 'upgrade-smoke-flow',
      version: '1.0.0',
      input: {},
    });

    const run = await runUntilSettled(engine, runId);
    expect(run?.status).toBe('COMPLETED');
    expect(run?.outputsJson).toEqual({ a: 1, b: 2 });
  });
});
