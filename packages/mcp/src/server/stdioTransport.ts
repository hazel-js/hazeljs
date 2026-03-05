/**
 * STDIO Transport
 *
 * Reads newline-delimited JSON from process.stdin, passes each message to the
 * supplied RequestHandler, and writes the JSON-RPC response back to
 * process.stdout followed by a newline.
 *
 * Design decisions:
 *   - Each incoming line is handled in its own promise chain (no await in the
 *     readline handler) so slow tool calls don't block subsequent requests.
 *   - JSON parse errors are returned as -32700 responses instead of crashing.
 *   - Unexpected handler exceptions are caught and returned as -32603 so the
 *     server never exits due to user input.
 *   - process.stdin 'close' triggers a clean process.exit(0) — MCP clients
 *     that close stdin expect the server to terminate.
 *
 * Extension note:
 *   To add HTTP/SSE transport, implement the same RequestHandler signature
 *   and wire it to incoming HTTP requests (e.g. via Express or Fastify).
 *   The handler itself, the adapter, and all protocol types stay unchanged.
 *
 *   Example HTTP skeleton:
 *     app.post('/rpc', async (req, res) => {
 *       const response = await handler(req.body as McpRequest);
 *       res.json(response);
 *     });
 */

import * as readline from 'readline';
import type { McpRequest, McpResponse, McpErrorResponse } from './types';
import { parseError, internalError } from './errors';

export type RequestHandler = (req: McpRequest) => Promise<McpResponse | McpErrorResponse>;

/**
 * Attach the STDIO transport to the current process.
 *
 * After this call, the process reads from stdin and writes to stdout until
 * stdin is closed. Call this once at server startup.
 */
export function createStdioTransport(handler: RequestHandler): void {
  const rl = readline.createInterface({
    input: process.stdin,
    // terminal: false disables readline's default SIGINT / line-echoing
    terminal: false,
  });

  rl.on('line', (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Fire-and-forget: concurrent tool calls are handled independently
    void handleLine(trimmed, handler);
  });

  rl.on('close', () => {
    // Client closed stdin — exit cleanly rather than hanging
    process.exit(0);
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function handleLine(line: string, handler: RequestHandler): Promise<void> {
  let request: McpRequest;

  try {
    request = JSON.parse(line) as McpRequest;
  } catch {
    writeResponse(parseError(null));
    return;
  }

  const id = request.id ?? null;

  try {
    const response = await handler(request);
    writeResponse(response);
  } catch (err) {
    // The handler should never throw, but guard here as a last resort
    writeResponse(internalError(id, err));
  }
}

function writeResponse(response: McpResponse | McpErrorResponse): void {
  process.stdout.write(JSON.stringify(response) + '\n');
}
