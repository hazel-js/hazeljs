import {
  ErrorCode,
  makeError,
  makeErrorResponse,
  parseError,
  invalidRequestError,
  methodNotFoundError,
  invalidParamsError,
  toolNotFoundError,
  internalError,
} from '../src/server/errors';

describe('ErrorCode constants', () => {
  it('has the correct standard JSON-RPC 2.0 codes', () => {
    expect(ErrorCode.PARSE_ERROR).toBe(-32700);
    expect(ErrorCode.INVALID_REQUEST).toBe(-32600);
    expect(ErrorCode.METHOD_NOT_FOUND).toBe(-32601);
    expect(ErrorCode.INVALID_PARAMS).toBe(-32602);
    expect(ErrorCode.INTERNAL_ERROR).toBe(-32603);
  });

  it('has the correct MCP application-level codes', () => {
    expect(ErrorCode.TOOL_NOT_FOUND).toBe(-32001);
    expect(ErrorCode.TOOL_EXECUTION_FAILED).toBe(-32002);
  });
});

describe('makeError()', () => {
  it('returns error object without data when data is undefined', () => {
    const err = makeError(-32700, 'Parse error');
    expect(err).toEqual({ code: -32700, message: 'Parse error' });
    expect(err).not.toHaveProperty('data');
  });

  it('includes data field when data is provided', () => {
    const err = makeError(-32603, 'Internal error', { detail: 'oops' });
    expect(err).toEqual({ code: -32603, message: 'Internal error', data: { detail: 'oops' } });
  });

  it('includes data field when data is null (falsy but defined)', () => {
    const err = makeError(-32603, 'Internal error', null);
    expect(err).toHaveProperty('data', null);
  });

  it('includes data field when data is 0', () => {
    const err = makeError(-32603, 'Internal error', 0);
    expect(err).toHaveProperty('data', 0);
  });
});

describe('makeErrorResponse()', () => {
  it('returns a complete JSON-RPC 2.0 error response', () => {
    const res = makeErrorResponse(1, -32601, 'Method not found');
    expect(res).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32601, message: 'Method not found' },
    });
  });

  it('passes data through to the error object', () => {
    const res = makeErrorResponse('req-1', -32603, 'Internal error', { info: 'x' });
    expect(res.error.data).toEqual({ info: 'x' });
  });

  it('works with null id', () => {
    const res = makeErrorResponse(null, -32700, 'Parse error');
    expect(res.id).toBeNull();
  });
});

describe('parseError()', () => {
  it('uses null as the default id', () => {
    const res = parseError();
    expect(res.id).toBeNull();
    expect(res.error.code).toBe(ErrorCode.PARSE_ERROR);
    expect(res.error.message).toBe('Parse error');
  });

  it('accepts an explicit id', () => {
    const res = parseError(42);
    expect(res.id).toBe(42);
    expect(res.error.code).toBe(ErrorCode.PARSE_ERROR);
  });

  it('accepts a string id', () => {
    const res = parseError('abc');
    expect(res.id).toBe('abc');
  });
});

describe('invalidRequestError()', () => {
  it('returns -32600 with default null id', () => {
    const res = invalidRequestError();
    expect(res.error.code).toBe(ErrorCode.INVALID_REQUEST);
    expect(res.error.message).toBe('Invalid Request');
    expect(res.id).toBeNull();
  });

  it('accepts a custom id', () => {
    const res = invalidRequestError(5);
    expect(res.id).toBe(5);
  });
});

describe('methodNotFoundError()', () => {
  it('includes the method name in the message', () => {
    const res = methodNotFoundError(2, 'unknown/method');
    expect(res.error.code).toBe(ErrorCode.METHOD_NOT_FOUND);
    expect(res.error.message).toBe('Method not found: unknown/method');
    expect(res.id).toBe(2);
  });

  it('works with null id', () => {
    const res = methodNotFoundError(null, 'foo');
    expect(res.id).toBeNull();
  });
});

describe('invalidParamsError()', () => {
  it('returns generic message when no detail is provided', () => {
    const res = invalidParamsError(3);
    expect(res.error.code).toBe(ErrorCode.INVALID_PARAMS);
    expect(res.error.message).toBe('Invalid params');
  });

  it('includes detail in the message when provided', () => {
    const res = invalidParamsError(3, 'Missing required field: name');
    expect(res.error.message).toBe('Invalid params: Missing required field: name');
  });

  it('works with null id', () => {
    const res = invalidParamsError(null, 'detail');
    expect(res.id).toBeNull();
  });
});

describe('toolNotFoundError()', () => {
  it('includes the tool name in the message', () => {
    const res = toolNotFoundError(4, 'my_tool');
    expect(res.error.code).toBe(ErrorCode.TOOL_NOT_FOUND);
    expect(res.error.message).toBe('Tool not found: my_tool');
    expect(res.id).toBe(4);
  });
});

describe('internalError()', () => {
  it('extracts message from an Error instance', () => {
    const err = new Error('something went wrong');
    const res = internalError(5, err);
    expect(res.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(res.error.message).toBe('Internal error');
    expect(res.error.data).toEqual({ message: 'something went wrong' });
  });

  it('passes plain objects through as data', () => {
    const res = internalError(5, { context: 'db timeout' });
    expect(res.error.data).toEqual({ context: 'db timeout' });
  });

  it('passes undefined through as data (omitted from error)', () => {
    const res = internalError(5, undefined);
    expect(res.error).not.toHaveProperty('data');
  });

  it('passes a string through as data', () => {
    const res = internalError(5, 'raw string');
    expect(res.error.data).toBe('raw string');
  });

  it('works with null id', () => {
    const res = internalError(null);
    expect(res.id).toBeNull();
    expect(res.error.code).toBe(ErrorCode.INTERNAL_ERROR);
  });
});
