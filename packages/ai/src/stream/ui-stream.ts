import type { ServerResponse } from 'http';
import type { AIStreamChunk } from '../ai-enhanced.types';

export interface UIStreamOptions {
  keepAliveMs?: number | false;
  errorText?: (error: unknown) => string;
  headers?: Record<string, string>;
  status?: number;
}

export interface StreamProgressEvent {
  toolCallId: string;
  toolName: string;
  progress: number;
  total?: number;
  message?: string;
}

/**
 * Pipe plain text deltas to a Node response.
 */
export async function pipeTextStreamToResponse(
  res: ServerResponse,
  source: AsyncIterable<AIStreamChunk>,
  options: UIStreamOptions = {}
): Promise<void> {
  const abort = wireClientAbort(res);
  let sent = false;
  try {
    if (!res.headersSent) {
      res.writeHead(options.status ?? 200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        ...(options.headers ?? {}),
      });
    }
    for await (const chunk of source) {
      if (abort.signal.aborted) break;
      if (chunk.delta) {
        sent = true;
        res.write(chunk.delta);
      }
    }
    res.end();
  } catch (error) {
    if (!sent) throw error;
    res.end();
  } finally {
    abort.dispose();
  }
}

/**
 * Pipe a simple UI message SSE stream (text deltas + tool events) to a Node response.
 */
export async function pipeUIMessageStreamToResponse(
  res: ServerResponse,
  source: AsyncIterable<
    | AIStreamChunk
    | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
    | { type: 'tool-result'; toolCallId: string; toolName: string; output: unknown }
    | { type: 'data-tool-progress'; data: StreamProgressEvent }
  >,
  options: UIStreamOptions = {}
): Promise<void> {
  const abort = wireClientAbort(res);
  const keepAliveMs = options.keepAliveMs === false ? 0 : (options.keepAliveMs ?? 15_000);
  let keepAlive: NodeJS.Timeout | undefined;
  let sent = false;

  const writeEvent = (payload: unknown): void => {
    sent = true;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    if (keepAlive) {
      clearInterval(keepAlive);
      keepAlive = setInterval(() => {
        if (!res.writableEnded) res.write(`: keep-alive\n\n`);
      }, keepAliveMs);
    }
  };

  try {
    if (!res.headersSent) {
      res.writeHead(options.status ?? 200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'x-accel-buffering': 'no',
        ...(options.headers ?? {}),
      });
    }
    if (keepAliveMs > 0) {
      keepAlive = setInterval(() => {
        if (!res.writableEnded) res.write(`: keep-alive\n\n`);
      }, keepAliveMs);
    }

    for await (const chunk of source) {
      if (abort.signal.aborted) break;
      if ('type' in chunk) {
        writeEvent(chunk);
        continue;
      }
      if (chunk.delta) {
        writeEvent({ type: 'text-delta', delta: chunk.delta });
      }
      if (chunk.done) {
        writeEvent({ type: 'finish', usage: chunk.usage });
      }
    }
    res.end();
  } catch (error) {
    if (!sent) {
      throw error;
    }
    const text =
      options.errorText?.(error) ??
      (error instanceof Error ? 'An error occurred.' : 'An error occurred.');
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', errorText: text })}\n\n`);
    } catch {
      /* ignore */
    }
    res.end();
  } finally {
    if (keepAlive) clearInterval(keepAlive);
    abort.dispose();
  }
}

export function wireClientAbort(res: ServerResponse): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  const onClose = (): void => {
    if (!controller.signal.aborted) {
      controller.abort(new Error('Client disconnected'));
    }
  };
  res.once('close', onClose);
  return {
    signal: controller.signal,
    dispose: (): void => {
      res.off('close', onClose);
    },
  };
}
