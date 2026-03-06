/**
 * JSON-RPC 2.0 Error Helpers
 *
 * Standard error codes: https://www.jsonrpc.org/specification#error_object
 *
 * MCP application-level codes occupy the -32000 to -32099 server-error range.
 * The server never throws — every error path returns a typed response object
 * so that the transport layer can safely serialize and send it.
 */

import type { McpError, McpErrorResponse } from './types';

// ---------------------------------------------------------------------------
// Error code constants
// ---------------------------------------------------------------------------

export const ErrorCode = {
  // Standard JSON-RPC 2.0 codes
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // MCP / application-level codes
  TOOL_NOT_FOUND: -32001,
  TOOL_EXECUTION_FAILED: -32002,
} as const;

// ---------------------------------------------------------------------------
// Primitive builders
// ---------------------------------------------------------------------------

export function makeError(code: number, message: string, data?: unknown): McpError {
  return { code, message, ...(data !== undefined ? { data } : {}) };
}

export function makeErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): McpErrorResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: makeError(code, message, data),
  };
}

// ---------------------------------------------------------------------------
// Named error constructors
// ---------------------------------------------------------------------------

/** -32700 — Line received from stdin could not be parsed as JSON */
export function parseError(id: string | number | null = null): McpErrorResponse {
  return makeErrorResponse(id, ErrorCode.PARSE_ERROR, 'Parse error');
}

/** -32600 — Message is not a valid JSON-RPC 2.0 request */
export function invalidRequestError(id: string | number | null = null): McpErrorResponse {
  return makeErrorResponse(id, ErrorCode.INVALID_REQUEST, 'Invalid Request');
}

/** -32601 — No handler registered for the given method */
export function methodNotFoundError(id: string | number | null, method: string): McpErrorResponse {
  return makeErrorResponse(id, ErrorCode.METHOD_NOT_FOUND, `Method not found: ${method}`);
}

/** -32602 — Required parameter missing or malformed */
export function invalidParamsError(id: string | number | null, detail?: string): McpErrorResponse {
  return makeErrorResponse(
    id,
    ErrorCode.INVALID_PARAMS,
    detail ? `Invalid params: ${detail}` : 'Invalid params'
  );
}

/** -32001 — Requested tool name is not registered in the adapter */
export function toolNotFoundError(id: string | number | null, toolName: string): McpErrorResponse {
  return makeErrorResponse(id, ErrorCode.TOOL_NOT_FOUND, `Tool not found: ${toolName}`);
}

/** -32603 — Unexpected exception inside a handler or tool execution */
export function internalError(id: string | number | null, detail?: unknown): McpErrorResponse {
  const data = detail instanceof Error ? { message: detail.message } : detail;
  return makeErrorResponse(id, ErrorCode.INTERNAL_ERROR, 'Internal error', data);
}
