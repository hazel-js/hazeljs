import { EventEmitter } from 'events';
import type { ServerResponse } from 'http';
import {
  pipeTextStreamToResponse,
  pipeUIMessageStreamToResponse,
  wireClientAbort,
} from './ui-stream';
import type { AIStreamChunk } from '../ai-enhanced.types';

function mockRes(): EventEmitter &
  ServerResponse & {
    headersSent: boolean;
    writableEnded: boolean;
    writeHead: jest.Mock;
    write: jest.Mock;
    end: jest.Mock;
  } {
  const res = new EventEmitter() as EventEmitter &
    ServerResponse & {
      headersSent: boolean;
      writableEnded: boolean;
      writeHead: jest.Mock;
      write: jest.Mock;
      end: jest.Mock;
    };
  res.headersSent = false;
  res.writableEnded = false;
  res.writeHead = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn(() => {
    res.writableEnded = true;
    return res;
  }) as unknown as typeof res.end;
  return res;
}

async function* textChunks(parts: Array<Partial<AIStreamChunk>>): AsyncGenerator<AIStreamChunk> {
  for (const p of parts) {
    yield {
      id: '1',
      content: p.content ?? '',
      delta: p.delta ?? '',
      done: p.done ?? false,
      usage: p.usage,
    };
  }
}

describe('ui-stream', () => {
  it('pipeTextStreamToResponse writes deltas and ends', async () => {
    const res = mockRes();
    await pipeTextStreamToResponse(
      res as unknown as ServerResponse,
      textChunks([{ delta: 'hi' }, { delta: '!', done: true }]),
      { status: 201, headers: { 'x-test': '1' } }
    );
    expect(res.writeHead).toHaveBeenCalledWith(
      201,
      expect.objectContaining({ 'Content-Type': 'text/plain; charset=utf-8', 'x-test': '1' })
    );
    expect(res.write).toHaveBeenCalledWith('hi');
    expect(res.write).toHaveBeenCalledWith('!');
    expect(res.end).toHaveBeenCalled();
  });

  it('pipeTextStreamToResponse rethrows when no bytes were sent', async () => {
    const res = mockRes();
    async function* boom(): AsyncGenerator<AIStreamChunk> {
      throw new Error('upstream');
      yield { id: '1', content: '', delta: '', done: true };
    }
    await expect(
      pipeTextStreamToResponse(res as unknown as ServerResponse, boom())
    ).rejects.toThrow('upstream');
  });

  it('pipeTextStreamToResponse ends quietly after partial send on error', async () => {
    const res = mockRes();
    async function* partial(): AsyncGenerator<AIStreamChunk> {
      yield { id: '1', content: 'a', delta: 'a', done: false };
      throw new Error('mid-stream');
    }
    await pipeTextStreamToResponse(res as unknown as ServerResponse, partial());
    expect(res.write).toHaveBeenCalledWith('a');
    expect(res.end).toHaveBeenCalled();
  });

  it('pipeUIMessageStreamToResponse emits text, tool, progress, and finish events', async () => {
    const res = mockRes();
    async function* mixed() {
      yield { type: 'tool-call' as const, toolCallId: 'c1', toolName: 'echo', input: { x: 1 } };
      yield {
        type: 'data-tool-progress' as const,
        data: { toolCallId: 'c1', toolName: 'echo', progress: 1, total: 2, message: 'working' },
      };
      yield { id: '1', content: 'ok', delta: 'ok', done: false };
      yield {
        id: '1',
        content: 'ok',
        delta: '',
        done: true,
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      };
      yield { type: 'tool-result' as const, toolCallId: 'c1', toolName: 'echo', output: 'ok' };
    }
    await pipeUIMessageStreamToResponse(res as unknown as ServerResponse, mixed(), {
      keepAliveMs: false,
      headers: { 'x-ui': '1' },
    });
    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ 'Content-Type': 'text/event-stream', 'x-ui': '1' })
    );
    const payloads = res.write.mock.calls.map((c) => String(c[0]));
    expect(payloads.some((p) => p.includes('tool-call'))).toBe(true);
    expect(payloads.some((p) => p.includes('text-delta'))).toBe(true);
    expect(payloads.some((p) => p.includes('finish'))).toBe(true);
    expect(payloads.some((p) => p.includes('tool-result'))).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });

  it('pipeUIMessageStreamToResponse writes error event after bytes sent', async () => {
    const res = mockRes();
    async function* failAfter() {
      yield { id: '1', content: 'x', delta: 'x', done: false };
      throw new Error('boom');
    }
    await pipeUIMessageStreamToResponse(res as unknown as ServerResponse, failAfter(), {
      keepAliveMs: false,
      errorText: () => 'custom',
    });
    expect(res.write.mock.calls.some((c) => String(c[0]).includes('custom'))).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });

  it('pipeUIMessageStreamToResponse rethrows before any event', async () => {
    const res = mockRes();
    async function* failFirst() {
      throw 'not-an-error';
      yield { id: '1', content: '', delta: '', done: true };
    }
    await expect(
      pipeUIMessageStreamToResponse(res as unknown as ServerResponse, failFirst(), {
        keepAliveMs: false,
      })
    ).rejects.toBe('not-an-error');
  });

  it('wireClientAbort aborts on close and dispose removes listener', () => {
    const res = mockRes();
    const { signal, dispose } = wireClientAbort(res as unknown as ServerResponse);
    expect(signal.aborted).toBe(false);
    res.emit('close');
    expect(signal.aborted).toBe(true);
    dispose();
  });
});
