import { HazelToolAdapter } from '../src/server/hazelToolAdapter';
import type { IToolRegistry, HazelTool } from '../src/server/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRegistry(tools: HazelTool[]): IToolRegistry {
  return {
    getAllTools: () => tools,
    getTool: (name) => tools.find((t) => t.name === name),
    hasTool: (name) => tools.some((t) => t.name === name),
  };
}

function makeTool(overrides: Partial<HazelTool> = {}): HazelTool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    target: {},
    method: jest.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// fromRegistry()
// ---------------------------------------------------------------------------

describe('HazelToolAdapter.fromRegistry()', () => {
  it('creates an adapter with no tools when registry is empty', () => {
    const adapter = HazelToolAdapter.fromRegistry(makeRegistry([]));
    expect(adapter.listTools()).toHaveLength(0);
  });

  it('snapshots all tools from the registry', () => {
    const registry = makeRegistry([
      makeTool({ name: 'tool_a' }),
      makeTool({ name: 'tool_b' }),
    ]);
    const adapter = HazelToolAdapter.fromRegistry(registry);
    const names = adapter.listTools().map((t) => t.name);
    expect(names).toContain('tool_a');
    expect(names).toContain('tool_b');
    expect(adapter.listTools()).toHaveLength(2);
  });

  it('uses tool.name as the map key (not registry key)', () => {
    // Registry stores under "agent.toolName" but metadata.name is just "toolName"
    const tool = makeTool({ name: 'lookup_customer' });
    const adapter = HazelToolAdapter.fromRegistry(makeRegistry([tool]));
    expect(adapter.hasTool('lookup_customer')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listTools()
// ---------------------------------------------------------------------------

describe('HazelToolAdapter.listTools()', () => {
  it('emits open schema when tool has no parameters', () => {
    const adapter = HazelToolAdapter.fromRegistry(
      makeRegistry([makeTool({ name: 'no_params', parameters: undefined })]),
    );
    const [def] = adapter.listTools();
    expect(def.inputSchema).toEqual({ type: 'object', properties: {}, required: [] });
  });

  it('emits open schema when parameters array is empty', () => {
    const adapter = HazelToolAdapter.fromRegistry(
      makeRegistry([makeTool({ name: 'empty_params', parameters: [] })]),
    );
    const [def] = adapter.listTools();
    expect(def.inputSchema.properties).toEqual({});
    expect(def.inputSchema.required).toEqual([]);
  });

  it('maps parameter name, type, and description correctly', () => {
    const adapter = HazelToolAdapter.fromRegistry(
      makeRegistry([
        makeTool({
          name: 'with_params',
          parameters: [{ name: 'email', type: 'string', description: 'User email', required: true }],
        }),
      ]),
    );
    const [def] = adapter.listTools();
    expect(def.inputSchema.properties['email']).toEqual({
      type: 'string',
      description: 'User email',
    });
    expect(def.inputSchema.required).toContain('email');
  });

  it('adds optional params to properties but not to required[]', () => {
    const adapter = HazelToolAdapter.fromRegistry(
      makeRegistry([
        makeTool({
          parameters: [{ name: 'limit', type: 'number', description: 'Max results', required: false }],
        }),
      ]),
    );
    const [def] = adapter.listTools();
    expect(def.inputSchema.properties['limit']).toBeDefined();
    expect(def.inputSchema.required).not.toContain('limit');
  });

  it('includes enum when present on a parameter', () => {
    const adapter = HazelToolAdapter.fromRegistry(
      makeRegistry([
        makeTool({
          parameters: [
            {
              name: 'priority',
              type: 'string',
              description: 'Ticket priority',
              enum: ['low', 'normal', 'high'],
            },
          ],
        }),
      ]),
    );
    const [def] = adapter.listTools();
    expect(def.inputSchema.properties['priority'].enum).toEqual(['low', 'normal', 'high']);
  });

  it('omits enum when not present on a parameter', () => {
    const adapter = HazelToolAdapter.fromRegistry(
      makeRegistry([
        makeTool({
          parameters: [{ name: 'query', type: 'string', description: 'Search query' }],
        }),
      ]),
    );
    const [def] = adapter.listTools();
    expect(def.inputSchema.properties['query']).not.toHaveProperty('enum');
  });

  it('returns name and description from the tool metadata', () => {
    const adapter = HazelToolAdapter.fromRegistry(
      makeRegistry([makeTool({ name: 'my_tool', description: 'Does something useful' })]),
    );
    const [def] = adapter.listTools();
    expect(def.name).toBe('my_tool');
    expect(def.description).toBe('Does something useful');
  });

  it('handles multiple required and optional params in the same tool', () => {
    const adapter = HazelToolAdapter.fromRegistry(
      makeRegistry([
        makeTool({
          parameters: [
            { name: 'a', type: 'string', description: 'Required', required: true },
            { name: 'b', type: 'number', description: 'Optional' },
            { name: 'c', type: 'boolean', description: 'Also required', required: true },
          ],
        }),
      ]),
    );
    const [def] = adapter.listTools();
    expect(def.inputSchema.required).toEqual(['a', 'c']);
    expect(Object.keys(def.inputSchema.properties)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// hasTool()
// ---------------------------------------------------------------------------

describe('HazelToolAdapter.hasTool()', () => {
  it('returns true for a registered tool', () => {
    const adapter = HazelToolAdapter.fromRegistry(makeRegistry([makeTool({ name: 'exists' })]));
    expect(adapter.hasTool('exists')).toBe(true);
  });

  it('returns false for an unknown tool', () => {
    const adapter = HazelToolAdapter.fromRegistry(makeRegistry([makeTool({ name: 'exists' })]));
    expect(adapter.hasTool('does_not_exist')).toBe(false);
  });

  it('returns false on empty registry', () => {
    const adapter = HazelToolAdapter.fromRegistry(makeRegistry([]));
    expect(adapter.hasTool('anything')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// invoke()
// ---------------------------------------------------------------------------

describe('HazelToolAdapter.invoke()', () => {
  it('calls the tool method with the provided input', async () => {
    const method = jest.fn().mockResolvedValue({ result: 42 });
    const target = { id: 'instance' };
    const adapter = HazelToolAdapter.fromRegistry(
      makeRegistry([makeTool({ name: 'calc', method, target })]),
    );

    const result = await adapter.invoke('calc', { a: 1, b: 2 });
    expect(method).toHaveBeenCalledWith({ a: 1, b: 2 });
    expect(result).toEqual({ result: 42 });
  });

  it('calls method.call with the correct target as `this`', async () => {
    const target = { multiplier: 3 };
    const method = jest.fn(function (this: typeof target, input: { n: number }) {
      return Promise.resolve({ result: input.n * this.multiplier });
    });

    const adapter = HazelToolAdapter.fromRegistry(
      makeRegistry([makeTool({ name: 'multiply', method, target })]),
    );

    const result = await adapter.invoke('multiply', { n: 5 }) as { result: number };
    expect(result.result).toBe(15);
  });

  it('throws an Error when the tool is not found', async () => {
    const adapter = HazelToolAdapter.fromRegistry(makeRegistry([]));
    await expect(adapter.invoke('missing', {})).rejects.toThrow('Tool not found: missing');
  });

  it('propagates exceptions thrown by the tool method', async () => {
    const method = jest.fn().mockRejectedValue(new Error('Tool crashed'));
    const adapter = HazelToolAdapter.fromRegistry(
      makeRegistry([makeTool({ name: 'crashing_tool', method })]),
    );
    await expect(adapter.invoke('crashing_tool', {})).rejects.toThrow('Tool crashed');
  });

  it('passes an empty object when called with no input', async () => {
    const method = jest.fn().mockResolvedValue({});
    const adapter = HazelToolAdapter.fromRegistry(
      makeRegistry([makeTool({ name: 'no_input', method })]),
    );
    await adapter.invoke('no_input', {});
    expect(method).toHaveBeenCalledWith({});
  });
});
