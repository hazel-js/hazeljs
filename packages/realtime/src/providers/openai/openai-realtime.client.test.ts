import logger from '@hazeljs/core';
import { OpenAIRealtimeClient } from './openai-realtime.client';

interface MockWsInstance {
  send: jest.Mock;
  close: jest.Mock;
  removeAllListeners: jest.Mock;
  on: jest.Mock;
  readyState: number;
}

jest.mock('ws', () => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const mockWs: MockWsInstance = {
    send: jest.fn(),
    close: jest.fn(),
    removeAllListeners: jest.fn(),
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
      if (event === 'open') {
        setImmediate(() => cb());
      }
      return mockWs;
    }),
    readyState: 1,
  };
  (global as { __mockWs?: MockWsInstance & { _handlers: typeof handlers } }).__mockWs =
    Object.assign(mockWs, { _handlers: handlers });
  const Ws = jest.fn(() => mockWs);
  (Ws as unknown as { OPEN: number }).OPEN = 1;
  return { __esModule: true, default: Ws };
});

const mockWs = (global as { __mockWs?: MockWsInstance }).__mockWs!;

describe('OpenAIRealtimeClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (mockWs) mockWs.readyState = 1;
  });

  describe('constructor', () => {
    it('should use default model gpt-realtime', () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      expect(client).toBeDefined();
    });

    it('should use provided model', () => {
      const client = new OpenAIRealtimeClient({
        apiKey: 'test',
        model: 'gpt-4o',
      });
      expect(client).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should connect and resolve', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test-key' });
      await client.connect();

      expect(client.connected).toBe(true);
      expect(mockWs.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should send session.update when sessionConfig provided', async () => {
      const client = new OpenAIRealtimeClient({
        apiKey: 'test-key',
        sessionConfig: {
          instructions: 'Be helpful',
          voice: 'marin',
        },
      });
      await client.connect();

      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('session.update'));
      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('Be helpful'));
      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('marin'));
    });

    it('should send session.update with inputFormat when provided', async () => {
      const client = new OpenAIRealtimeClient({
        apiKey: 'test-key',
        sessionConfig: {
          voice: 'alloy',
          inputFormat: { type: 'audio/pcm' as const },
        },
      });
      await client.connect();

      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('session.update'));
      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('audio/pcm'));
    });
  });

  describe('send', () => {
    it('should throw when not connected', () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      expect(() => client.send({ type: 'test' })).toThrow('WebSocket not connected');
    });

    it('should send event when connected', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      client.send({ type: 'custom.event', data: 'test' });

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'custom.event', data: 'test' })
      );
    });
  });

  describe('appendAudio', () => {
    it('should send input_audio_buffer.append', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      client.appendAudio('base64audio');

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: 'base64audio',
        })
      );
    });
  });

  describe('commitInputBuffer', () => {
    it('should send input_audio_buffer.commit', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      client.commitInputBuffer();

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'input_audio_buffer.commit' })
      );
    });
  });

  describe('clearInputBuffer', () => {
    it('should send input_audio_buffer.clear', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      client.clearInputBuffer();

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'input_audio_buffer.clear' })
      );
    });
  });

  describe('createResponse', () => {
    it('should send response.create', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      client.createResponse({ outputModalities: ['text'] });

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'response.create',
          response: { outputModalities: ['text'] },
        })
      );
    });
  });

  describe('addConversationItem', () => {
    it('should send conversation.item.create', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      client.addConversationItem('Hello');

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: 'Hello' }],
          },
        })
      );
    });
  });

  describe('on', () => {
    it('should register handler and return unsubscribe', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      const handler = jest.fn();
      const unsubscribe = client.on('session.created', handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should invoke handler when server sends matching event', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      const handler = jest.fn();
      client.on('session.created', handler);

      const msgHandler = (mockWs as { _handlers?: Record<string, (d: unknown) => void> })
        ._handlers?.['message'];
      expect(msgHandler).toBeDefined();
      msgHandler!(
        Buffer.from(JSON.stringify({ type: 'session.created', session: { id: 'sess-1' } }))
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'session.created', session: { id: 'sess-1' } })
      );
    });

    it('should catch type handler errors and continue', async () => {
      const loggerSpy = jest.spyOn(logger, 'error').mockImplementation();
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      const handler = jest.fn().mockImplementation(() => {
        throw new Error('handler error');
      });
      client.on('test.event', handler);

      const msgHandler = (mockWs as { _handlers?: Record<string, (d: unknown) => void> })
        ._handlers?.['message'];
      msgHandler!(Buffer.from(JSON.stringify({ type: 'test.event' })));

      expect(loggerSpy).toHaveBeenCalledWith(
        'Realtime event handler error (test.event):',
        expect.any(Error)
      );
      loggerSpy.mockRestore();
    });

    it('should catch generic handler errors and continue', async () => {
      const loggerSpy = jest.spyOn(logger, 'error').mockImplementation();
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      const handler = jest.fn().mockImplementation(() => {
        throw new Error('generic handler error');
      });
      client.onAny(handler);

      const msgHandler = (mockWs as { _handlers?: Record<string, (d: unknown) => void> })
        ._handlers?.['message'];
      msgHandler!(Buffer.from(JSON.stringify({ type: 'other.event' })));

      expect(loggerSpy).toHaveBeenCalledWith('Realtime generic handler error:', expect.any(Error));
      loggerSpy.mockRestore();
    });
  });

  describe('onAny', () => {
    it('should register handler and return unsubscribe', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      const handler = jest.fn();
      const unsubscribe = client.onAny(handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should invoke onAny when server sends any event', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      const handler = jest.fn();
      client.onAny(handler);

      const msgHandler = (mockWs as { _handlers?: Record<string, (d: unknown) => void> })
        ._handlers?.['message'];
      msgHandler!(Buffer.from(JSON.stringify({ type: 'response.done' })));

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'response.done' }));
    });
  });

  describe('server message handling', () => {
    it('should emit error on invalid JSON message', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      const errorHandler = jest.fn();
      client.on('error', errorHandler);

      const msgHandler = (mockWs as { _handlers?: Record<string, (d: unknown) => void> })
        ._handlers?.['message'];
      msgHandler!(Buffer.from('not json'));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', error: expect.any(String) })
      );
    });

    it('should emit session.ended on close', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      const endedHandler = jest.fn();
      client.on('session.ended', endedHandler);

      const closeHandler = (
        mockWs as { _handlers?: Record<string, (code?: number, reason?: Buffer) => void> }
      )._handlers?.['close'];
      closeHandler!(1000, Buffer.from('normal'));

      expect(endedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'session.ended', code: 1000 })
      );
      expect(client.connected).toBe(false);
    });

    it('should handle ws error event', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      const errorHandler = jest.fn();
      client.on('error', errorHandler);

      const wsErrorHandler = (mockWs as { _handlers?: Record<string, (err: Error) => void> })
        ._handlers?.['error'];
      wsErrorHandler!(new Error('ws error'));

      expect(client.connected).toBe(false);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', error: 'ws error' })
      );
    });
  });

  describe('disconnect', () => {
    it('should close websocket and cleanup', async () => {
      const client = new OpenAIRealtimeClient({ apiKey: 'test' });
      await client.connect();

      client.disconnect();

      expect(mockWs.removeAllListeners).toHaveBeenCalled();
      expect(mockWs.close).toHaveBeenCalled();
      expect(client.connected).toBe(false);
    });
  });
});
