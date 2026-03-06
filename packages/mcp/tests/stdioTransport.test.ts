/**
 * stdioTransport tests
 *
 * Strategy: mock the 'readline' module so we can control what lines arrive on
 * stdin without touching the real process.stdin. We capture the EventEmitter
 * that readline.createInterface() returns, then emit 'line' and 'close' events
 * to drive the transport. process.stdout.write is spied on to verify output.
 */

import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Module-level readline mock — must be declared before any imports that use it
// ---------------------------------------------------------------------------

let mockRlInstance: EventEmitter;

jest.mock('readline', () => ({
  createInterface: jest.fn().mockImplementation(() => {
    mockRlInstance = new EventEmitter();
    return mockRlInstance;
  }),
}));

// Import AFTER the mock is in place
import { createStdioTransport } from '../src/server/stdioTransport';
import type { McpRequest, McpResponse, McpErrorResponse } from '../src/server/types';
import { ErrorCode } from '../src/server/errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AnyResponse = McpResponse | McpErrorResponse;

function successHandler(result: unknown = {}): jest.Mock {
  return jest.fn().mockResolvedValue({ jsonrpc: '2.0', id: 1, result } as McpResponse);
}

function parsedOutput(spy: jest.SpyInstance, callIndex = 0): AnyResponse {
  const raw = (spy.mock.calls[callIndex][0] as string).trimEnd();
  return JSON.parse(raw) as AnyResponse;
}

/** Emit a line and wait for all micro-tasks + the internal promise chain to settle */
async function emitLine(line: string): Promise<void> {
  mockRlInstance.emit('line', line);
  // Two ticks: one for the void promise, one for the internal await
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let stdoutSpy: jest.SpyInstance;

beforeEach(() => {
  stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  jest.clearAllMocks();
});

afterEach(() => {
  stdoutSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createStdioTransport — valid JSON', () => {
  it('calls the handler with the parsed request object', async () => {
    const handler = successHandler({ ok: true });
    createStdioTransport(handler);

    await emitLine('{"jsonrpc":"2.0","id":1,"method":"ping"}');

    expect(handler).toHaveBeenCalledTimes(1);
    const calledWith = handler.mock.calls[0][0] as McpRequest;
    expect(calledWith.method).toBe('ping');
    expect(calledWith.id).toBe(1);
  });

  it('writes the handler response as newline-terminated JSON to stdout', async () => {
    createStdioTransport(successHandler({ pong: true }));
    await emitLine('{"jsonrpc":"2.0","id":2,"method":"ping"}');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const written = stdoutSpy.mock.calls[0][0] as string;
    expect(written).toMatch(/\n$/);
    const parsed = JSON.parse(written.trim()) as McpResponse;
    expect(parsed.result).toEqual({ pong: true });
  });

  it('handles requests with null id', async () => {
    const handler = successHandler({});
    createStdioTransport(handler);
    await emitLine('{"jsonrpc":"2.0","id":null,"method":"tools/list"}');

    expect(handler).toHaveBeenCalledTimes(1);
    const calledWith = handler.mock.calls[0][0] as McpRequest;
    expect(calledWith.id).toBeNull();
  });
});

describe('createStdioTransport — invalid JSON', () => {
  it('writes a -32700 parse error response without calling the handler', async () => {
    const handler = jest.fn();
    createStdioTransport(handler);

    await emitLine('not valid json {{{');

    expect(handler).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledTimes(1);

    const out = parsedOutput(stdoutSpy) as McpErrorResponse;
    expect(out.error.code).toBe(ErrorCode.PARSE_ERROR);
    expect(out.id).toBeNull();
  });

  it('continues processing subsequent lines after a parse error', async () => {
    const handler = successHandler({});
    createStdioTransport(handler);

    await emitLine('{bad json}');
    await emitLine('{"jsonrpc":"2.0","id":3,"method":"ping"}');

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    // first call: parse error; second call: successful response
    const first = parsedOutput(stdoutSpy, 0) as McpErrorResponse;
    const second = parsedOutput(stdoutSpy, 1) as McpResponse;
    expect(first.error.code).toBe(ErrorCode.PARSE_ERROR);
    expect(second.result).toBeDefined();
  });
});

describe('createStdioTransport — empty / whitespace lines', () => {
  it('ignores completely empty lines', async () => {
    const handler = jest.fn();
    createStdioTransport(handler);
    await emitLine('');

    expect(handler).not.toHaveBeenCalled();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('ignores whitespace-only lines', async () => {
    const handler = jest.fn();
    createStdioTransport(handler);
    await emitLine('   \t  ');

    expect(handler).not.toHaveBeenCalled();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});

describe('createStdioTransport — handler throws', () => {
  it('writes a -32603 internal error response when the handler rejects', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('unexpected boom'));
    createStdioTransport(handler);

    await emitLine('{"jsonrpc":"2.0","id":5,"method":"ping"}');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const out = parsedOutput(stdoutSpy) as McpErrorResponse;
    expect(out.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(out.id).toBe(5);
  });

  it('uses null id when request has no id and handler throws', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    createStdioTransport(handler);

    await emitLine('{"jsonrpc":"2.0","id":null,"method":"ping"}');

    const out = parsedOutput(stdoutSpy) as McpErrorResponse;
    expect(out.id).toBeNull();
  });
});

describe('createStdioTransport — concurrent requests', () => {
  it('handles multiple lines independently without blocking', async () => {
    let resolveFirst!: (v: AnyResponse) => void;
    let resolveSecond!: (v: AnyResponse) => void;

    const first = new Promise<AnyResponse>((res) => { resolveFirst = res; });
    const second = new Promise<AnyResponse>((res) => { resolveSecond = res; });

    const handler = jest.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    createStdioTransport(handler);

    mockRlInstance.emit('line', '{"jsonrpc":"2.0","id":1,"method":"ping"}');
    mockRlInstance.emit('line', '{"jsonrpc":"2.0","id":2,"method":"ping"}');

    await new Promise((r) => setImmediate(r));

    // Both requests received by the handler before either resolves
    expect(handler).toHaveBeenCalledTimes(2);

    // Resolve in reverse order to confirm independence
    resolveSecond({ jsonrpc: '2.0', id: 2, result: { second: true } });
    resolveFirst({ jsonrpc: '2.0', id: 1, result: { first: true } });

    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
  });
});

describe('createStdioTransport — stdin close', () => {
  it('calls process.exit(0) when stdin closes', () => {
    createStdioTransport(jest.fn());
    mockRlInstance.emit('close');
    expect(process.exit).toHaveBeenCalledWith(0);
  });
});
