import {
  Skillgate,
  SkillgateConfigError,
  SkillgateSsrfError,
  parseOpenApiOperations,
  matchesInclude,
  classifyOperation,
  AgentSkill,
  getAgentSkillMetadata,
  getAgentSkillMethods,
  isAgentSkill,
  toXHazelSkill,
  assertSafeBaseUrl,
  type OpenApiLike,
} from '../src';
import { ToolRegistry } from '@hazeljs/agent';
import { Controller, Get, Param, ApiTags, HazelModule } from '@hazeljs/core';

const cleanSpec: OpenApiLike = {
  servers: [{ url: 'http://127.0.0.1:3000' }],
  paths: {
    '/orders/{id}': {
      get: {
        operationId: 'getOrder',
        tags: ['agent'],
        summary: 'Fetch an order by id',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Order id',
          },
        ],
      },
      delete: {
        operationId: 'deleteOrder',
        tags: ['agent'],
        summary: 'Delete an order',
      },
    },
    '/tickets': {
      post: {
        operationId: 'createTicket',
        tags: ['agent'],
        summary: 'Create a support ticket',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['subject'],
                properties: {
                  subject: { type: 'string', description: 'Subject' },
                  body: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    '/refunds': {
      post: {
        operationId: 'createRefund',
        summary: 'Create a refund',
        'x-hazel-skill': { requiresApproval: true },
      },
    },
    '/admin/users': {
      get: {
        operationId: 'listAdminUsers',
        tags: ['agent'],
        summary: 'List admin users',
      },
    },
    '/catalog': {
      get: {
        operationId: 'listCatalog',
        tags: ['public'],
        summary: 'Public catalog',
      },
    },
    '/disabled': {
      get: {
        operationId: 'disabledOp',
        tags: ['agent'],
        summary: 'Disabled',
        'x-hazel-skill': false,
      },
    },
    '/health': {
      get: {
        operationId: 'health',
        tags: ['agent'],
        summary: 'Health check',
      },
    },
  },
};

describe('parseOpenApiOperations', () => {
  it('extracts methods, tags, and x-hazel-skill', () => {
    const ops = parseOpenApiOperations(cleanSpec);
    expect(ops.find((o) => o.operationId === 'getOrder')?.tags).toContain('agent');
    expect(ops.find((o) => o.operationId === 'createRefund')?.xHazelSkill).toEqual({
      requiresApproval: true,
    });
    expect(ops.some((o) => o.name === 'getOrder')).toBe(true);
  });

  it('skips non-http path keys', () => {
    const ops = parseOpenApiOperations({
      paths: {
        '/x': {
          get: { summary: 'ok' },
          parameters: [] as never,
        },
      },
    });
    expect(ops).toHaveLength(1);
  });
});

describe('matchesInclude', () => {
  const base = parseOpenApiOperations(cleanSpec);

  it('opt-in includes agent tag and x-hazel-skill', () => {
    const getOrder = base.find((o) => o.operationId === 'getOrder')!;
    const refund = base.find((o) => o.operationId === 'createRefund')!;
    const catalog = base.find((o) => o.operationId === 'listCatalog')!;
    const disabled = base.find((o) => o.operationId === 'disabledOp')!;

    expect(matchesInclude(getOrder, { mode: 'opt-in' })).toBe(true);
    expect(matchesInclude(refund, { mode: 'opt-in' })).toBe(true);
    expect(matchesInclude(catalog, { mode: 'opt-in' })).toBe(false);
    expect(matchesInclude(disabled, { mode: 'opt-in' })).toBe(false);
  });

  it('respects operationIds and deny', () => {
    const getOrder = base.find((o) => o.operationId === 'getOrder')!;
    expect(matchesInclude(getOrder, { mode: 'opt-in', operationIds: ['getOrder'], tags: [] })).toBe(
      true
    );
    expect(matchesInclude(getOrder, { mode: 'all', deny: ['getOrder'] })).toBe(false);
    expect(matchesInclude(getOrder, { mode: 'all', deny: [/orders/] })).toBe(false);
  });

  it('filters by methods and path globs', () => {
    const getOrder = base.find((o) => o.operationId === 'getOrder')!;
    expect(matchesInclude(getOrder, { mode: 'all', methods: ['POST'] })).toBe(false);
    expect(
      matchesInclude(getOrder, { mode: 'opt-in', paths: ['/orders/*'], tags: [], operationIds: [] })
    ).toBe(true);
  });
});

describe('classifyOperation', () => {
  it('classifies read / write / destructive / admin', () => {
    const ops = parseOpenApiOperations(cleanSpec);
    const getOrder = ops.find((o) => o.operationId === 'getOrder')!;
    const create = ops.find((o) => o.operationId === 'createTicket')!;
    const del = ops.find((o) => o.operationId === 'deleteOrder')!;
    const admin = ops.find((o) => o.operationId === 'listAdminUsers')!;
    const health = ops.find((o) => o.operationId === 'health')!;

    expect(classifyOperation(getOrder).class).toBe('read');
    expect(classifyOperation(getOrder).requiresApproval).toBe(false);

    expect(classifyOperation(create).class).toBe('write');
    expect(classifyOperation(create).requiresApproval).toBe(true);

    expect(classifyOperation(del).denied).toBe(true);
    expect(classifyOperation(del, { allowDestructive: true }).denied).toBeFalsy();

    expect(classifyOperation(admin).denied).toBe(true);
    expect(classifyOperation(health).denied).toBe(true);
  });
});

describe('Skillgate.fromOpenApi', () => {
  it('includes curated skills and denies destructive/admin', () => {
    const gate = Skillgate.fromOpenApi(cleanSpec);
    const names = gate.list().map((s) => s.name);
    expect(names).toContain('getOrder');
    expect(names).toContain('createTicket');
    expect(names).toContain('createRefund');
    expect(names).not.toContain('deleteOrder');
    expect(names).not.toContain('listAdminUsers');
    expect(names).not.toContain('listCatalog');

    const report = gate.report();
    expect(report.denied.some((d) => d.name === 'deleteOrder')).toBe(true);
    expect(report.denied.some((d) => d.name === 'listAdminUsers')).toBe(true);
  });

  it('mode all warns and still denies destructive by default', () => {
    const gate = Skillgate.fromOpenApi(cleanSpec, { include: { mode: 'all' }, force: true });
    expect(gate.report().warnings.some((w) => w.includes('"all"'))).toBe(true);
    expect(gate.list().some((s) => s.name === 'listCatalog')).toBe(true);
    expect(gate.list().some((s) => s.name === 'deleteOrder')).toBe(false);
  });

  it('throws when exceeding maxTools without force', () => {
    expect(() =>
      Skillgate.fromOpenApi(cleanSpec, {
        include: { mode: 'all' },
        classify: { allowDestructive: true, allowAdmin: true },
        maxTools: 1,
      })
    ).toThrow(SkillgateConfigError);
  });

  it('strictDescriptions denies placeholder summaries', () => {
    const gate = Skillgate.fromOpenApi(
      {
        paths: {
          '/bare': {
            get: { tags: ['agent'], description: 'GET /bare' },
          },
        },
      },
      { strictDescriptions: true }
    );
    expect(gate.list()).toHaveLength(0);
    expect(gate.report().denied[0]?.denyReason).toMatch(/strictDescriptions/);
  });

  it('registers tools on ToolRegistry with approval + metadata', async () => {
    const gate = Skillgate.fromOpenApi(cleanSpec, {
      invoke: { baseUrl: 'http://127.0.0.1:3000', headers: { Authorization: 'Bearer ${TOKEN}' } },
    });
    const registry = new ToolRegistry();
    const count = gate.register(registry, 'api-concierge');
    expect(count).toBe(gate.list().length);

    const tools = registry.getAgentTools('api-concierge');
    const getOrder = tools.find((t) => t.name === 'getOrder')!;
    expect(getOrder.requiresApproval).toBeFalsy();
    expect(getOrder.metadata?.readOnly).toBe(true);
    expect(getOrder.metadata?.skillgate).toBe(true);

    const create = tools.find((t) => t.name === 'createTicket')!;
    expect(create.requiresApproval).toBe(true);

    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      text: async () => '{"id":"1"}',
    });
    const prev = global.fetch;
    global.fetch = fetchMock as never;
    process.env.TOKEN = 'secret';
    try {
      // re-register with env resolved
      registry.clear();
      Skillgate.fromOpenApi(cleanSpec, {
        invoke: { baseUrl: 'http://127.0.0.1:3000', headers: { Authorization: 'Bearer ${TOKEN}' } },
      }).register(registry, 'api-concierge');
      const tool = registry.getAgentTools('api-concierge').find((t) => t.name === 'getOrder')!;
      const result = await tool.method({ id: '1' });
      expect(result).toEqual({ status: 200, data: { id: '1' } });
      expect(fetchMock).toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain('/orders/1');
      expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer secret' });
    } finally {
      global.fetch = prev;
      delete process.env.TOKEN;
    }
  });

  it('warns when above warnAbove', () => {
    const gate = Skillgate.fromOpenApi(cleanSpec, {
      include: { mode: 'all' },
      classify: { allowDestructive: true, allowAdmin: true },
      warnAbove: 1,
      force: true,
    });
    expect(gate.report().warnings.some((w) => w.includes('warnAbove'))).toBe(true);
  });
});

describe('SSRF', () => {
  it('allows localhost when protection off', () => {
    expect(() => assertSafeBaseUrl('http://127.0.0.1:3000', false)).not.toThrow();
    expect(() => assertSafeBaseUrl(undefined, true)).not.toThrow();
  });

  it('blocks private hosts when protection on', () => {
    expect(() => assertSafeBaseUrl('http://127.0.0.1:3000', true)).toThrow(SkillgateSsrfError);
    expect(() => assertSafeBaseUrl('http://localhost:3000', true)).toThrow(SkillgateSsrfError);
    expect(() => assertSafeBaseUrl('http://10.1.2.3/', true)).toThrow(SkillgateSsrfError);
    expect(() => assertSafeBaseUrl('http://192.168.1.1/', true)).toThrow(SkillgateSsrfError);
    expect(() => assertSafeBaseUrl('http://172.16.0.1/', true)).toThrow(SkillgateSsrfError);
    expect(() => assertSafeBaseUrl('http://169.254.169.254/', true)).toThrow(SkillgateSsrfError);
    expect(() => assertSafeBaseUrl('http://metadata.google.internal/', true)).toThrow(
      SkillgateSsrfError
    );
    expect(() => assertSafeBaseUrl('not a url', true)).toThrow(SkillgateSsrfError);
    expect(() => assertSafeBaseUrl('https://api.example.com', true)).not.toThrow();
  });

  it('fromOpenApi enforces ssrfProtection', () => {
    expect(() =>
      Skillgate.fromOpenApi(cleanSpec, {
        invoke: { baseUrl: 'http://10.0.0.1', ssrfProtection: true },
      })
    ).toThrow(SkillgateSsrfError);
  });
});

describe('classify edge cases', () => {
  it('honors x-hazel-skill class override and allowAdmin', () => {
    const op = {
      name: 'admin_read',
      description: 'Admin',
      method: 'GET' as const,
      path: '/admin/stats',
      parameters: [],
      tags: ['agent'],
      xHazelSkill: { class: 'read' as const, readOnly: true },
    };
    // x.class read bypasses admin deny path when class is read
    expect(classifyOperation(op).denied).toBeFalsy();
    expect(classifyOperation(op).class).toBe('read');

    const options = {
      name: 'opts',
      description: 'Options',
      method: 'OPTIONS' as const,
      path: '/x',
      parameters: [],
      tags: [],
    };
    expect(classifyOperation(options).class).toBe('write');

    const admin = {
      name: 'a',
      description: 'a',
      method: 'GET' as const,
      path: '/ok',
      parameters: [],
      tags: [],
      xHazelSkill: { class: 'admin' as const },
    };
    expect(classifyOperation(admin).denied).toBe(true);
    expect(classifyOperation(admin, { allowAdmin: true }).denied).toBeFalsy();
  });
});

describe('@AgentSkill', () => {
  class Demo {
    @AgentSkill({ description: 'Fetch order', readOnly: true })
    getOrder() {
      return 1;
    }

    @AgentSkill({ enabled: false })
    hidden() {
      return 2;
    }

    plain() {
      return 3;
    }
  }

  it('stores and reads metadata', () => {
    const demo = new Demo();
    expect(getAgentSkillMethods(Demo)).toEqual(expect.arrayContaining(['getOrder', 'hidden']));
    expect(isAgentSkill(demo, 'getOrder')).toBe(true);
    expect(isAgentSkill(demo, 'hidden')).toBe(false);
    expect(isAgentSkill(demo, 'plain')).toBe(false);

    const meta = getAgentSkillMetadata(demo, 'getOrder')!;
    expect(meta.description).toBe('Fetch order');
    expect(toXHazelSkill(meta)).toMatchObject({
      enabled: true,
      readOnly: true,
      description: 'Fetch order',
    });
  });
});

describe('enrichSpecWithAgentSkills', () => {
  it('patches operations by operationId', () => {
    class Orders {
      @AgentSkill({ description: 'Fetch order by id', readOnly: true })
      getOrder() {}
    }

    const spec: OpenApiLike = {
      paths: {
        '/orders/{id}': {
          get: {
            operationId: 'getOrder',
            summary: 'Get',
            tags: ['orders'],
          },
        },
      },
    };

    const { enrichSpecWithAgentSkills } = require('../src/enrich-agent-skills');
    enrichSpecWithAgentSkills(spec, [Orders]);
    const getOp = spec.paths!['/orders/{id}'].get as { 'x-hazel-skill'?: unknown };
    expect(getOp['x-hazel-skill']).toMatchObject({
      enabled: true,
      readOnly: true,
      description: 'Fetch order by id',
    });
  });
});

describe('fromModule / toMcpServer integration', () => {
  it('fromModule builds skills from a Hazel module via swagger', () => {
    @ApiTags('agent')
    @Controller('/orders')
    class OrdersController {
      @Get('/:id')
      getOrder(@Param('id') _id: string) {
        return { ok: true };
      }
    }

    @HazelModule({ controllers: [OrdersController] })
    class AppModule {}

    const gate = Skillgate.fromModule(AppModule, {
      swagger: { title: 'Test', servers: [{ url: 'http://127.0.0.1:3000' }] },
      invoke: { baseUrl: 'http://127.0.0.1:3000' },
      force: true,
    });
    expect(gate.list().length).toBeGreaterThan(0);
    expect(gate.list().some((s) => s.path.includes('orders'))).toBe(true);
  });

  it('toMcpServer creates an MCP server', () => {
    const gate = Skillgate.fromOpenApi(cleanSpec, {
      invoke: { baseUrl: 'http://127.0.0.1:3000' },
    });
    const server = gate.toMcpServer({ name: 'test-skills', version: '0.0.1' });
    expect(typeof server.listenStdio).toBe('function');
    expect(typeof server.listTools).toBe('function');
    const tools = server.listTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });
});

describe('defaultSkillgateOptions', () => {
  it('merges production-safe defaults', () => {
    const { defaultSkillgateOptions, SKILLGATE_DEFAULT_CLASSIFY } = require('../src/defaults');
    const opts = defaultSkillgateOptions({ include: { tags: ['orders'] }, agentName: 'orders' });
    expect(opts.classify).toMatchObject(SKILLGATE_DEFAULT_CLASSIFY);
    expect(opts.include?.tags).toEqual(['orders']);
    expect(opts.agentName).toBe('orders');
    expect(opts.include?.mode).toBe('opt-in');
  });
});
