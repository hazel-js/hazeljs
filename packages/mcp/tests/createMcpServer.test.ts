/**
 * createMcpServer tests
 *
 * Strategy: mock createStdioTransport so we can capture the internal
 * handleRequest function and call it directly without touching process.stdin.
 * This lets us test every router branch in isolation.
 */

import { createMcpServer } from '../src/server/createMcpServer';
import type { IToolRegistry, HazelTool, McpRequest, McpResponse, McpErrorResponse } from '../src/server/types';
import { ErrorCode } from '../src/server/errors';

// ---------------------------------------------------------------------------
// Mock stdioTransport so listenStdio() doesn't bind process.stdin
// ---------------------------------------------------------------------------

let capturedHandler: ((req: McpRequest) => Promise<McpResponse | McpErrorResponse>) | undefined;

jest.mock('../src/server/stdioTransport', () => ({
  createStdioTransport: jest.fn((handler: (req: McpRequest) => Promise<McpResponse | McpErrorResponse>) => {
    capturedHandler = handler;
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRegistry(tools: HazelTool[] = []): IToolRegistry {
  return {
    getAllTools: () => tools,
    getTool: (name) => tools.find((t) => t.name === name),
    hasTool: (name) => tools.some((t) => t.name === name),
  };
}

function makeTool(overrides: Partial<HazelTool> = {}): HazelTool {
  return {
    name: 'echo',
    description: 'Echoes input',
    parameters: [{ name: 'msg', type: 'string', description: 'Message', required: true }],
    target: {},
    method: jest.fn().mockResolvedValue({ echoed: true }),
    ...overrides,
  };
}

function req(method: string, params?: unknown, id: string | number | null = 1): McpRequest {
  return { jsonrpc: '2.0', id, method, params } as McpRequest;
}

async function call(server: ReturnType<typeof createMcpServer>, request: McpRequest) {
  server.listenStdio();
  if (!capturedHandler) throw new Error('handler not captured');
  return capturedHandler(request);
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

describe('createMcpServer — initialize', () => {
  it('returns protocol version, serverInfo, and capabilities', async () => {
    const server = createMcpServer({ name: 'test-server', version: '1.2.3', toolRegistry: makeRegistry() });
    const res = await call(server, req('initialize')) as McpResponse;

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
    const result = res.result as Record<string, unknown>;
    expect(result['protocolVersion']).toBe('2024-11-05');
    expect(result['serverInfo']).toEqual({ name: 'test-server', version: '1.2.3' });
    expect(result['capabilities']).toEqual({ tools: {} });
  });

  it('reflects the name and version from options', async () => {
    const server = createMcpServer({ name: 'my-agent', version: '0.9.0', toolRegistry: makeRegistry() });
    const res = await call(server, req('initialize')) as McpResponse;
    const result = res.result as Record<string, unknown>;
    const serverInfo = result['serverInfo'] as Record<string, unknown>;
    expect(serverInfo['name']).toBe('my-agent');
    expect(serverInfo['version']).toBe('0.9.0');
  });

  it('works with a null id', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    const res = await call(server, req('initialize', undefined, null));
    expect(res.id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// initialized (notification ack)
// ---------------------------------------------------------------------------

describe('createMcpServer — initialized', () => {
  it('returns an empty result ack', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    const res = await call(server, req('initialized')) as McpResponse;
    expect(res.result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// ping
// ---------------------------------------------------------------------------

describe('createMcpServer — ping', () => {
  it('returns empty result', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    const res = await call(server, req('ping')) as McpResponse;
    expect(res.result).toEqual({});
  });

  it('preserves the request id', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    const res = await call(server, req('ping', undefined, 'ping-42'));
    expect(res.id).toBe('ping-42');
  });
});

// ---------------------------------------------------------------------------
// tools/list
// ---------------------------------------------------------------------------

describe('createMcpServer — tools/list', () => {
  it('returns an empty tools array when no tools registered', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    const res = await call(server, req('tools/list')) as McpResponse;
    const result = res.result as Record<string, unknown>;
    expect(result['tools']).toEqual([]);
  });

  it('returns MCP tool definitions for registered tools', async () => {
    const tool = makeTool({ name: 'add', description: 'Add numbers' });
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry([tool]) });
    const res = await call(server, req('tools/list')) as McpResponse;
    const result = res.result as Record<string, unknown>;
    const tools = result['tools'] as Array<Record<string, unknown>>;
    expect(tools).toHaveLength(1);
    expect(tools[0]['name']).toBe('add');
    expect(tools[0]['description']).toBe('Add numbers');
  });
});

// ---------------------------------------------------------------------------
// tools/call
// ---------------------------------------------------------------------------

describe('createMcpServer — tools/call', () => {
  it('invokes the tool and returns a content block response', async () => {
    const method = jest.fn().mockResolvedValue({ result: 10 });
    const tool = makeTool({ name: 'add', method });
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry([tool]) });

    const res = await call(server, req('tools/call', { name: 'add', arguments: { a: 3, b: 7 } })) as McpResponse;
    const result = res.result as Record<string, unknown>;

    expect(result['isError']).toBe(false);
    const content = result['content'] as Array<Record<string, unknown>>;
    expect(content[0]['type']).toBe('text');
    expect(content[0]['text']).toBe(JSON.stringify({ result: 10 }));
    expect(method).toHaveBeenCalledWith({ a: 3, b: 7 });
  });

  it('passes empty object as arguments when arguments is omitted', async () => {
    const method = jest.fn().mockResolvedValue({});
    const tool = makeTool({ name: 'noop', method });
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry([tool]) });

    await call(server, req('tools/call', { name: 'noop' }));
    expect(method).toHaveBeenCalledWith({});
  });

  it('returns -32602 when params.name is missing', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    const res = await call(server, req('tools/call', {})) as McpErrorResponse;

    expect(res.error.code).toBe(ErrorCode.INVALID_PARAMS);
    expect(res.error.message).toContain('Missing required field: name');
  });

  it('returns -32602 when params is absent entirely', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    const res = await call(server, req('tools/call', undefined)) as McpErrorResponse;

    expect(res.error.code).toBe(ErrorCode.INVALID_PARAMS);
  });

  it('returns -32001 when the tool name is not registered', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    const res = await call(server, req('tools/call', { name: 'ghost_tool' })) as McpErrorResponse;

    expect(res.error.code).toBe(ErrorCode.TOOL_NOT_FOUND);
    expect(res.error.message).toContain('ghost_tool');
  });

  it('returns -32603 when the tool method throws', async () => {
    const method = jest.fn().mockRejectedValue(new Error('DB connection lost'));
    const tool = makeTool({ name: 'failing_tool', method });
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry([tool]) });

    const res = await call(server, req('tools/call', { name: 'failing_tool', arguments: {} })) as McpErrorResponse;

    expect(res.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(res.error.data).toEqual({ message: 'DB connection lost' });
  });

  it('preserves the request id in all error responses', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    const res = await call(server, req('tools/call', { name: 'missing' }, 99));
    expect(res.id).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// unknown method
// ---------------------------------------------------------------------------

describe('createMcpServer — unknown method', () => {
  it('returns -32601 METHOD_NOT_FOUND', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    const res = await call(server, req('nonexistent/method')) as McpErrorResponse;

    expect(res.error.code).toBe(ErrorCode.METHOD_NOT_FOUND);
    expect(res.error.message).toContain('nonexistent/method');
  });

  it('includes the request id in the error response', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    const res = await call(server, req('bad/method', undefined, 7));
    expect(res.id).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// server.listTools()
// ---------------------------------------------------------------------------

describe('createMcpServer — server.listTools()', () => {
  it('returns the same definitions as tools/list', async () => {
    const tool = makeTool({ name: 'my_tool' });
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry([tool]) });

    const listed = server.listTools();
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('my_tool');
  });

  it('returns an empty array when no tools are registered', () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    expect(server.listTools()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// null / undefined id edge cases
// ---------------------------------------------------------------------------

describe('createMcpServer — id handling', () => {
  it('passes through null id to all response types', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });

    const ping = await call(server, req('ping', undefined, null));
    expect(ping.id).toBeNull();

    const unknown = await call(server, req('no_such_method', undefined, null));
    expect(unknown.id).toBeNull();
  });

  it('handles numeric id 0', async () => {
    const server = createMcpServer({ name: 's', version: '1', toolRegistry: makeRegistry() });
    const res = await call(server, req('ping', undefined, 0));
    expect(res.id).toBe(0);
  });
});
