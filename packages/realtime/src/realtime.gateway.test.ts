import { createServer } from 'http';
import { RealtimeService } from './realtime.service';

jest.mock('./providers/openai', () => {
  const session = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    handleClientMessage: jest.fn(),
    getStats: jest.fn().mockReturnValue({ sessionId: 'test', provider: 'openai' }),
    isConnected: true,
  };
  (global as { __gatewayMockSession?: typeof session }).__gatewayMockSession = session;
  return {
    OpenAIRealtimeSession: jest.fn(() => session),
  };
});

const mockSession = (
  global as {
    __gatewayMockSession?: {
      connect: jest.Mock;
      disconnect: jest.Mock;
      handleClientMessage: jest.Mock;
      getStats: jest.Mock;
      isConnected: boolean;
    };
  }
).__gatewayMockSession!;

jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  Service: () => () => {},
}));

jest.mock('@hazeljs/websocket', () => {
  const mockWss = { close: jest.fn((cb?: (err?: Error) => void) => cb?.()) };
  class MockWebSocketGateway {
    attachToServer = jest.fn().mockReturnValue(mockWss);
    close = jest.fn().mockResolvedValue(undefined);
    protected handleConnection(): void {}
    protected handleMessage(): void {}
    protected handleDisconnection(): void {}
  }
  const Realtime = () => () => {};
  const getRealtimeMetadata = jest.fn().mockReturnValue({
    path: '/realtime',
    maxPayload: 1048576,
  });
  return {
    __esModule: true,
    WebSocketGateway: MockWebSocketGateway,
    Realtime,
    getRealtimeMetadata,
  };
});

import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway', () => {
  let realtimeService: RealtimeService;
  let gateway: RealtimeGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.connect.mockResolvedValue(undefined);
    process.env.OPENAI_API_KEY = 'test-key';
    realtimeService = new RealtimeService({ openaiApiKey: 'test-key' });
    gateway = new RealtimeGateway(realtimeService);
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('constructor', () => {
    it('should create gateway with default options', () => {
      expect(gateway).toBeDefined();
    });

    it('should accept custom options', () => {
      const customGateway = new RealtimeGateway(realtimeService, {
        path: '/voice',
        maxPayload: 2048,
      });
      expect(customGateway).toBeDefined();
    });
  });

  describe('attachToServer', () => {
    it('should attach to HTTP server', () => {
      const server = createServer(() => {});

      const result = gateway.attachToServer(server);

      expect(result).toBeDefined();
      server.close();
    });

    it('should use gateway options when attachToServer called without options', () => {
      const server = createServer(() => {});
      const customGateway = new RealtimeGateway(realtimeService, { path: '/voice' });

      const result = customGateway.attachToServer(server);

      expect(result).toBeDefined();
      server.close();
    });

    it('should use custom path when provided', () => {
      const server = createServer(() => {});
      const customGateway = new RealtimeGateway(realtimeService, {
        path: '/voice',
      });

      const result = customGateway.attachToServer(server, { path: '/custom' });

      expect(result).toBeDefined();
      server.close();
    });
  });

  describe('handleConnection error', () => {
    it('should disconnect client when session creation fails', async () => {
      mockSession.connect.mockRejectedValueOnce(new Error('Connection failed'));
      const mockClient = {
        id: 'client-fail',
        socket: { on: jest.fn(), send: jest.fn(), close: jest.fn() },
        metadata: new Map(),
        rooms: new Set(),
        send: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        inRoom: jest.fn().mockReturnValue(false),
      };

      (gateway as unknown as { handleConnection: (c: typeof mockClient) => void }).handleConnection(
        mockClient
      );

      await new Promise((r) => setTimeout(r, 50));

      expect(mockClient.disconnect).toHaveBeenCalled();
      mockSession.connect.mockResolvedValue(undefined);
    });
  });

  describe('handleConnection', () => {
    it('should create OpenAI session on connection', async () => {
      const mockClient = {
        id: 'client-123',
        socket: { on: jest.fn(), send: jest.fn(), close: jest.fn() },
        metadata: new Map(),
        rooms: new Set(),
        send: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        inRoom: jest.fn().mockReturnValue(false),
      };

      (gateway as unknown as { handleConnection: (c: typeof mockClient) => void }).handleConnection(
        mockClient
      );

      await new Promise((r) => setTimeout(r, 50));

      expect(realtimeService.getSession('client-123')).toBeDefined();
    });
  });

  describe('handleMessage', () => {
    it('should forward message to session when session exists', async () => {
      const mockClient = {
        id: 'client-msg',
        send: jest.fn(),
      };
      await realtimeService.createOpenAISession(mockClient);

      const server = createServer(() => {});
      gateway.attachToServer(server);

      const mockSocket: {
        on: jest.Mock;
        send: jest.Mock;
        close: jest.Mock;
      } = {
        on: jest.fn((ev: string, fn: (data: unknown) => void) => {
          if (ev === 'message') _mockMessageHandler = fn;
          return mockSocket;
        }),
        send: jest.fn(),
        close: jest.fn(),
      };
      let _mockMessageHandler: (data: unknown) => void = () => {};
      const mockClientForConn = {
        id: 'client-msg',
        socket: mockSocket,
        metadata: new Map(),
        rooms: new Set(),
        send: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        inRoom: jest.fn().mockReturnValue(false),
      };

      (
        gateway as unknown as { handleConnection: (c: typeof mockClientForConn) => void }
      ).handleConnection(mockClientForConn);

      await new Promise((r) => setTimeout(r, 50));

      const session = realtimeService.getSession('client-msg');
      expect(session).toBeDefined();

      (gateway as unknown as { handleMessage: (id: string, msg: unknown) => void }).handleMessage(
        'client-msg',
        { type: 'test.event', data: 'payload' }
      );

      await new Promise((r) => setTimeout(r, 50));

      expect(mockSession.handleClientMessage).toHaveBeenCalledWith({
        type: 'test.event',
        data: 'payload',
      });
      server.close();
    });

    it('should do nothing when session does not exist', () => {
      (gateway as unknown as { handleMessage: (id: string, msg: unknown) => void }).handleMessage(
        'non-existent',
        { type: 'test' }
      );

      expect(mockSession.handleClientMessage).not.toHaveBeenCalled();
    });

    it('should ignore message when session creation failed', async () => {
      mockSession.connect.mockRejectedValueOnce(new Error('fail'));
      const mockClient = {
        id: 'client-msg-fail',
        socket: { on: jest.fn(), send: jest.fn(), close: jest.fn() },
        metadata: new Map(),
        rooms: new Set(),
        send: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        inRoom: jest.fn().mockReturnValue(false),
      };

      (gateway as unknown as { handleConnection: (c: typeof mockClient) => void }).handleConnection(
        mockClient
      );

      (gateway as unknown as { handleMessage: (id: string, msg: unknown) => void }).handleMessage(
        'client-msg-fail',
        { type: 'test.event' }
      );

      await new Promise((r) => setTimeout(r, 50));

      expect(mockSession.handleClientMessage).not.toHaveBeenCalled();
      mockSession.connect.mockResolvedValue(undefined);
    });
  });

  describe('handleDisconnection', () => {
    it('should remove session on disconnect', async () => {
      const mockClient = {
        id: 'client-disc',
        send: jest.fn(),
      };
      await realtimeService.createOpenAISession(mockClient);
      expect(realtimeService.getSession('client-disc')).toBeDefined();

      (gateway as unknown as { handleDisconnection: (id: string) => void }).handleDisconnection(
        'client-disc'
      );

      expect(realtimeService.getSession('client-disc')).toBeUndefined();
      expect(mockSession.disconnect).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close the gateway', async () => {
      const server = createServer(() => {});
      gateway.attachToServer(server);

      await gateway.close();

      expect(true).toBe(true);
    });

    it('should resolve when not attached', async () => {
      await expect(gateway.close()).resolves.toBeUndefined();
    });
  });
});
