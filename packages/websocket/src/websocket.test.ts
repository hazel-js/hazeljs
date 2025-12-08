import { RoomManager } from './room/room.manager';
import { SSEHandler, createSSEResponse, sendSSEMessage } from './sse/sse.handler';
import { WebSocketGateway, createWebSocketClient } from './websocket.gateway';
import { WebSocketMessage } from './websocket.types';
import {
  Realtime,
  Subscribe,
  OnConnect,
  OnDisconnect,
  OnMessage,
  Client,
  Data,
  getRealtimeMetadata,
  getSubscribeMetadata,
  getOnConnectMetadata,
  getOnDisconnectMetadata,
  getOnMessageMetadata,
  getParameterMetadata,
  isRealtimeGateway,
} from './decorators/realtime.decorator';

// Test index.ts exports
describe('Index exports', () => {
  it('should export all expected modules', () => {
    // This test ensures all exports are available
    // If imports fail, TypeScript will catch it
    expect(RoomManager).toBeDefined();
    expect(SSEHandler).toBeDefined();
    expect(WebSocketGateway).toBeDefined();
    expect(createWebSocketClient).toBeDefined();
    expect(createSSEResponse).toBeDefined();
    expect(sendSSEMessage).toBeDefined();
    expect(Realtime).toBeDefined();
    expect(Subscribe).toBeDefined();
    expect(OnConnect).toBeDefined();
    expect(OnDisconnect).toBeDefined();
    expect(OnMessage).toBeDefined();
    expect(Client).toBeDefined();
    expect(Data).toBeDefined();
  });
});

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  describe('room operations', () => {
    it('should create a room', () => {
      const room = roomManager.createRoom('test-room');

      expect(room).toBeDefined();
      expect(room.name).toBe('test-room');
      expect(room.clients.size).toBe(0);
    });

    it('should return existing room if already exists', () => {
      const room1 = roomManager.createRoom('test-room');
      const room2 = roomManager.createRoom('test-room');

      expect(room1).toBe(room2);
    });

    it('should get a room', () => {
      roomManager.createRoom('test-room');
      const room = roomManager.getRoom('test-room');

      expect(room).toBeDefined();
      expect(room?.name).toBe('test-room');
    });

    it('should return undefined for non-existent room', () => {
      const room = roomManager.getRoom('non-existent');
      expect(room).toBeUndefined();
    });

    it('should delete a room', () => {
      roomManager.createRoom('test-room');
      const deleted = roomManager.deleteRoom('test-room');

      expect(deleted).toBe(true);
      expect(roomManager.getRoom('test-room')).toBeUndefined();
    });

    it('should return false when deleting non-existent room', () => {
      const deleted = roomManager.deleteRoom('non-existent');
      expect(deleted).toBe(false);
    });

    it('should get all rooms', () => {
      roomManager.createRoom('room1');
      roomManager.createRoom('room2');
      roomManager.createRoom('room3');

      const rooms = roomManager.getAllRooms();
      expect(rooms).toHaveLength(3);
      expect(rooms.map((r) => r.name)).toContain('room1');
      expect(rooms.map((r) => r.name)).toContain('room2');
      expect(rooms.map((r) => r.name)).toContain('room3');
    });
  });

  describe('client operations', () => {
    it('should add client to room', () => {
      roomManager.addClientToRoom('client1', 'room1');

      const room = roomManager.getRoom('room1');
      expect(room?.clients.has('client1')).toBe(true);
    });

    it('should remove client from room', () => {
      roomManager.addClientToRoom('client1', 'room1');
      roomManager.removeClientFromRoom('client1', 'room1');

      const room = roomManager.getRoom('room1');
      expect(room).toBeUndefined(); // Room deleted when empty
    });

    it('should get client rooms', () => {
      roomManager.addClientToRoom('client1', 'room1');
      roomManager.addClientToRoom('client1', 'room2');

      const rooms = roomManager.getClientRooms('client1');
      expect(rooms).toHaveLength(2);
      expect(rooms).toContain('room1');
      expect(rooms).toContain('room2');
    });

    it('should get room clients', () => {
      roomManager.addClientToRoom('client1', 'room1');
      roomManager.addClientToRoom('client2', 'room1');

      const clients = roomManager.getRoomClients('room1');
      expect(clients).toHaveLength(2);
      expect(clients).toContain('client1');
      expect(clients).toContain('client2');
    });

    it('should check if client is in room', () => {
      roomManager.addClientToRoom('client1', 'room1');

      expect(roomManager.isClientInRoom('client1', 'room1')).toBe(true);
      expect(roomManager.isClientInRoom('client1', 'room2')).toBe(false);
    });

    it('should remove client from all rooms', () => {
      roomManager.addClientToRoom('client1', 'room1');
      roomManager.addClientToRoom('client1', 'room2');

      roomManager.removeClientFromAllRooms('client1');

      expect(roomManager.getClientRooms('client1')).toHaveLength(0);
    });

    it('should handle removing client from all rooms when client has no rooms', () => {
      roomManager.removeClientFromAllRooms('non-existent');
      // Should not throw
    });

    it('should handle removing client from non-existent room', () => {
      roomManager.removeClientFromRoom('client1', 'non-existent');
      // Should not throw
    });

    it('should get total client count across all rooms', () => {
      roomManager.addClientToRoom('client1', 'room1');
      roomManager.addClientToRoom('client2', 'room1');
      roomManager.addClientToRoom('client3', 'room2');

      const count = roomManager.getTotalClientCount();
      expect(count).toBe(3);
    });

    it('should broadcast to room', () => {
      const mockClient1 = {
        id: 'client1',
        send: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        inRoom: jest.fn(),
        socket: {},
        metadata: new Map(),
        rooms: new Set<string>(),
      };
      const mockClient2 = {
        id: 'client2',
        send: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        inRoom: jest.fn(),
        socket: {},
        metadata: new Map(),
        rooms: new Set<string>(),
      };

      const clients = new Map([
        ['client1', mockClient1],
        ['client2', mockClient2],
      ]) as any;

      roomManager.addClientToRoom('client1', 'room1');
      roomManager.addClientToRoom('client2', 'room1');

      roomManager.broadcastToRoom('room1', 'test-event', { data: 'test' }, clients);

      expect(mockClient1.send).toHaveBeenCalledWith('test-event', { data: 'test' });
      expect(mockClient2.send).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('should broadcast to room excluding client', () => {
      const mockClient1 = {
        id: 'client1',
        send: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        inRoom: jest.fn(),
        socket: {},
        metadata: new Map(),
        rooms: new Set<string>(),
      };
      const mockClient2 = {
        id: 'client2',
        send: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        inRoom: jest.fn(),
        socket: {},
        metadata: new Map(),
        rooms: new Set<string>(),
      };

      const clients = new Map([
        ['client1', mockClient1],
        ['client2', mockClient2],
      ]) as any;

      roomManager.addClientToRoom('client1', 'room1');
      roomManager.addClientToRoom('client2', 'room1');

      roomManager.broadcastToRoom('room1', 'test-event', { data: 'test' }, clients, 'client1');

      expect(mockClient1.send).not.toHaveBeenCalled();
      expect(mockClient2.send).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('should not broadcast to non-existent room', () => {
      const clients = new Map();
      roomManager.broadcastToRoom('non-existent', 'test-event', { data: 'test' }, clients);
      // Should not throw
    });
  });

  describe('statistics', () => {
    it('should get room count', () => {
      roomManager.createRoom('room1');
      roomManager.createRoom('room2');

      expect(roomManager.getRoomCount()).toBe(2);
    });

    it('should get stats', () => {
      roomManager.addClientToRoom('client1', 'room1');
      roomManager.addClientToRoom('client2', 'room1');

      const stats = roomManager.getStats();
      expect(stats.totalRooms).toBe(1);
      expect(stats.totalClients).toBe(2);
    });
  });

  describe('metadata', () => {
    it('should set and get room metadata', () => {
      roomManager.createRoom('room1');
      roomManager.setRoomMetadata('room1', 'key', 'value');

      expect(roomManager.getRoomMetadata('room1', 'key')).toBe('value');
    });
  });

  describe('clear', () => {
    it('should clear all rooms', () => {
      roomManager.createRoom('room1');
      roomManager.createRoom('room2');

      roomManager.clear();

      expect(roomManager.getRoomCount()).toBe(0);
    });
  });
});

describe('SSEHandler', () => {
  let sseHandler: SSEHandler;
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    sseHandler = new SSEHandler();
    mockReq = {
      on: jest.fn(),
    };
    mockRes = {
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
  });

  afterEach(() => {
    sseHandler.closeAll();
    jest.clearAllMocks();
  });

  it('should get connection count', () => {
    expect(sseHandler.getConnectionCount()).toBe(0);
  });

  it('should check if connection exists', () => {
    expect(sseHandler.hasConnection('test-id')).toBe(false);
  });

  it('should get connection IDs', () => {
    const ids = sseHandler.getConnectionIds();
    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toHaveLength(0);
  });

  it('should initialize connection', () => {
    const connectionId = sseHandler.initConnection(mockReq, mockRes);

    expect(connectionId).toBeDefined();
    expect(mockRes.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      })
    );
    expect(sseHandler.getConnectionCount()).toBe(1);
    expect(sseHandler.hasConnection(connectionId)).toBe(true);
  });

  it('should initialize connection with retry option', () => {
    const connectionId = sseHandler.initConnection(mockReq, mockRes, { retry: 5000 });

    expect(connectionId).toBeDefined();
    expect(mockRes.write).toHaveBeenCalledWith('retry: 5000\n\n');
  });

  it('should handle connection close', () => {
    const connectionId = sseHandler.initConnection(mockReq, mockRes);

    // Simulate connection close
    const closeCallback = mockReq.on.mock.calls.find((call: any[]) => call[0] === 'close')?.[1];
    if (closeCallback) {
      closeCallback();
    }

    expect(sseHandler.hasConnection(connectionId)).toBe(false);
  });

  it('should send message to connection', () => {
    const connectionId = sseHandler.initConnection(mockReq, mockRes);

    const result = sseHandler.send(connectionId, {
      event: 'test-event',
      data: { foo: 'bar' },
    });

    expect(result).toBe(true);
    expect(mockRes.write).toHaveBeenCalled();
  });

  it('should return false when sending to non-existent connection', () => {
    const result = sseHandler.send('non-existent', {
      event: 'test-event',
      data: { foo: 'bar' },
    });

    expect(result).toBe(false);
  });

  it('should send message with all fields', () => {
    const connectionId = sseHandler.initConnection(mockReq, mockRes);

    sseHandler.send(connectionId, {
      event: 'test-event',
      id: '123',
      retry: 5000,
      data: { foo: 'bar' },
    });

    expect(mockRes.write).toHaveBeenCalled();
    const written = mockRes.write.mock.calls[0][0];
    expect(written).toContain('event: test-event');
    expect(written).toContain('id: 123');
    expect(written).toContain('retry: 5000');
    expect(written).toContain('data: {"foo":"bar"}');
  });

  it('should handle multi-line data', () => {
    const connectionId = sseHandler.initConnection(mockReq, mockRes);

    sseHandler.send(connectionId, {
      event: 'test-event',
      data: 'line1\nline2\nline3',
    });

    expect(mockRes.write).toHaveBeenCalled();
    const written = mockRes.write.mock.calls[0][0];
    expect(written).toContain('data: line1');
    expect(written).toContain('data: line2');
    expect(written).toContain('data: line3');
  });

  it('should broadcast to all connections', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _connectionId1 = sseHandler.initConnection(mockReq, mockRes);
    const mockReq2 = { on: jest.fn() } as any;
    const mockRes2 = { writeHead: jest.fn(), write: jest.fn(), end: jest.fn() } as any;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _connectionId2 = sseHandler.initConnection(mockReq2, mockRes2);

    sseHandler.broadcast({
      event: 'broadcast-event',
      data: { message: 'broadcast' },
    });

    expect(mockRes.write).toHaveBeenCalled();
    expect(mockRes2.write).toHaveBeenCalled();
  });

  it('should close specific connection', () => {
    const connectionId = sseHandler.initConnection(mockReq, mockRes);

    expect(sseHandler.hasConnection(connectionId)).toBe(true);

    sseHandler.closeConnection(connectionId);

    expect(sseHandler.hasConnection(connectionId)).toBe(false);
    expect(mockRes.end).toHaveBeenCalled();
  });

  it('should close all connections', () => {
    sseHandler.initConnection(mockReq, mockRes);
    const mockReq2 = { on: jest.fn() } as any;
    const mockRes2 = { writeHead: jest.fn(), write: jest.fn(), end: jest.fn() } as any;
    sseHandler.initConnection(mockReq2, mockRes2);

    expect(sseHandler.getConnectionCount()).toBe(2);

    sseHandler.closeAll();

    expect(sseHandler.getConnectionCount()).toBe(0);
    expect(mockRes.end).toHaveBeenCalled();
    expect(mockRes2.end).toHaveBeenCalled();
  });

  describe('createSSEResponse', () => {
    it('should create SSE response with headers', () => {
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
      } as any;

      createSSEResponse(mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        })
      );
    });

    it('should include retry option', () => {
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
      } as any;

      createSSEResponse(mockRes, { retry: 5000 });

      expect(mockRes.write).toHaveBeenCalledWith('retry: 5000\n\n');
    });
  });

  describe('sendSSEMessage', () => {
    it('should send SSE message', () => {
      const mockRes = {
        write: jest.fn(),
      } as any;

      sendSSEMessage(mockRes, {
        event: 'test-event',
        data: { foo: 'bar' },
      });

      expect(mockRes.write).toHaveBeenCalled();
      const written = mockRes.write.mock.calls[0][0];
      expect(written).toContain('event: test-event');
      expect(written).toContain('data: {"foo":"bar"}');
    });

    it('should send message with all fields', () => {
      const mockRes = {
        write: jest.fn(),
      } as any;

      sendSSEMessage(mockRes, {
        event: 'test-event',
        id: '123',
        retry: 5000,
        data: 'test data',
      });

      const written = mockRes.write.mock.calls[0][0];
      expect(written).toContain('event: test-event');
      expect(written).toContain('id: 123');
      expect(written).toContain('retry: 5000');
      expect(written).toContain('data: test data');
    });

    it('should handle multi-line data', () => {
      const mockRes = {
        write: jest.fn(),
      } as any;

      sendSSEMessage(mockRes, {
        event: 'test-event',
        data: 'line1\nline2',
      });

      const written = mockRes.write.mock.calls[0][0];
      expect(written).toContain('data: line1');
      expect(written).toContain('data: line2');
    });
  });

  describe('createStream', () => {
    it('should create async stream', async () => {
      const connectionId = sseHandler.initConnection(mockReq, mockRes);

      const dataSource = async function* () {
        yield { id: 1, value: 'first' };
        yield { id: 2, value: 'second' };
        yield { id: 3, value: 'third' };
      };

      const results: boolean[] = [];
      for await (const result of sseHandler.createStream(connectionId, dataSource(), {
        event: 'stream-event',
      })) {
        results.push(result);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(mockRes.write).toHaveBeenCalled();
    });

    it('should handle stream with transform', async () => {
      const connectionId = sseHandler.initConnection(mockReq, mockRes);

      const dataSource = [1, 2, 3];

      const results: boolean[] = [];
      for await (const result of sseHandler.createStream(connectionId, dataSource, {
        event: 'stream-event',
        transform: (n: number) => ({ value: n * 2 }),
      })) {
        results.push(result);
      }

      expect(results.length).toBe(3);
    });

    it('should handle stream errors gracefully', async () => {
      const connectionId = sseHandler.initConnection(mockReq, mockRes);

      const dataSource = async function* () {
        yield { id: 1 };
        throw new Error('Stream error');
      };

      const results: boolean[] = [];
      for await (const result of sseHandler.createStream(connectionId, dataSource())) {
        results.push(result);
      }

      // Should handle error without throwing
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('WebSocketGateway', () => {
  let gateway: WebSocketGateway;

  beforeEach(() => {
    gateway = new WebSocketGateway();
  });

  describe('client management', () => {
    it('should get client count', () => {
      expect(gateway.getClientCount()).toBe(0);
    });

    it('should get clients', () => {
      const clients = gateway.getClients();
      expect(Array.isArray(clients)).toBe(true);
      expect(clients).toHaveLength(0);
    });

    it('should handle client connection', () => {
      const mockSocket = { send: jest.fn(), close: jest.fn() };
      const client = createWebSocketClient(mockSocket, 'client1');

      // Access protected method via type assertion
      (gateway as any).handleConnection(client);

      expect(gateway.getClientCount()).toBe(1);
      expect(gateway.getClient('client1')).toBeDefined();
    });

    it('should handle client disconnection', () => {
      const mockSocket = { send: jest.fn(), close: jest.fn() };
      const client = createWebSocketClient(mockSocket, 'client1');

      (gateway as any).handleConnection(client);
      expect(gateway.getClientCount()).toBe(1);

      (gateway as any).handleDisconnection('client1');
      expect(gateway.getClientCount()).toBe(0);
      expect(gateway.getClient('client1')).toBeUndefined();
    });

    it('should handle disconnection of non-existent client', () => {
      (gateway as any).handleDisconnection('non-existent');
      expect(gateway.getClientCount()).toBe(0);
    });

    it('should handle incoming message', () => {
      const mockSocket = { send: jest.fn(), close: jest.fn() };
      const client = createWebSocketClient(mockSocket, 'client1');

      (gateway as any).handleConnection(client);

      const message: WebSocketMessage = {
        event: 'test',
        data: { foo: 'bar' },
        timestamp: Date.now(),
      };
      (gateway as any).handleMessage('client1', message);

      const stats = gateway.getStats();
      expect(stats.messagesReceived).toBe(1);
      expect(stats.bytesReceived).toBeGreaterThan(0);
    });

    it('should get client by ID', () => {
      const mockSocket = { send: jest.fn(), close: jest.fn() };
      const client = createWebSocketClient(mockSocket, 'client1');

      (gateway as any).handleConnection(client);

      const retrieved = gateway.getClient('client1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('client1');

      const notFound = gateway.getClient('non-existent');
      expect(notFound).toBeUndefined();
    });
  });

  describe('messaging', () => {
    it('should send message to specific client', () => {
      const mockSocket = { send: jest.fn(), close: jest.fn() };
      const client = createWebSocketClient(mockSocket, 'client1');

      (gateway as any).handleConnection(client);

      const result = gateway.sendToClient('client1', 'test-event', { data: 'test' });
      expect(result).toBe(true);
      expect(mockSocket.send).toHaveBeenCalled();

      const stats = gateway.getStats();
      expect(stats.messagesSent).toBe(1);
    });

    it('should return false when sending to non-existent client', () => {
      const result = gateway.sendToClient('non-existent', 'test-event', { data: 'test' });
      expect(result).toBe(false);
    });

    it('should broadcast to all clients', () => {
      const mockSocket1 = { send: jest.fn(), close: jest.fn() };
      const mockSocket2 = { send: jest.fn(), close: jest.fn() };
      const client1 = createWebSocketClient(mockSocket1, 'client1');
      const client2 = createWebSocketClient(mockSocket2, 'client2');

      (gateway as any).handleConnection(client1);
      (gateway as any).handleConnection(client2);

      gateway.broadcast('test-event', { data: 'broadcast' });

      expect(mockSocket1.send).toHaveBeenCalled();
      expect(mockSocket2.send).toHaveBeenCalled();

      const stats = gateway.getStats();
      expect(stats.messagesSent).toBe(2);
    });

    it('should broadcast excluding specific client', () => {
      const mockSocket1 = { send: jest.fn(), close: jest.fn() };
      const mockSocket2 = { send: jest.fn(), close: jest.fn() };
      const client1 = createWebSocketClient(mockSocket1, 'client1');
      const client2 = createWebSocketClient(mockSocket2, 'client2');

      (gateway as any).handleConnection(client1);
      (gateway as any).handleConnection(client2);

      gateway.broadcast('test-event', { data: 'broadcast' }, 'client1');

      expect(mockSocket1.send).not.toHaveBeenCalled();
      expect(mockSocket2.send).toHaveBeenCalled();
    });

    it('should broadcast to room', () => {
      const mockSocket1 = { send: jest.fn(), close: jest.fn() };
      const mockSocket2 = { send: jest.fn(), close: jest.fn() };
      const client1 = createWebSocketClient(mockSocket1, 'client1');
      const client2 = createWebSocketClient(mockSocket2, 'client2');

      (gateway as any).handleConnection(client1);
      (gateway as any).handleConnection(client2);

      gateway.joinRoom('client1', 'room1');
      gateway.joinRoom('client2', 'room1');

      gateway.broadcastToRoom('room1', 'test-event', { data: 'room-broadcast' });

      expect(mockSocket1.send).toHaveBeenCalled();
      expect(mockSocket2.send).toHaveBeenCalled();

      const stats = gateway.getStats();
      expect(stats.messagesSent).toBe(1);
    });

    it('should broadcast to room excluding client', () => {
      const mockSocket1 = { send: jest.fn(), close: jest.fn() };
      const mockSocket2 = { send: jest.fn(), close: jest.fn() };
      const client1 = createWebSocketClient(mockSocket1, 'client1');
      const client2 = createWebSocketClient(mockSocket2, 'client2');

      (gateway as any).handleConnection(client1);
      (gateway as any).handleConnection(client2);

      gateway.joinRoom('client1', 'room1');
      gateway.joinRoom('client2', 'room1');

      gateway.broadcastToRoom('room1', 'test-event', { data: 'room-broadcast' }, 'client1');

      expect(mockSocket1.send).not.toHaveBeenCalled();
      expect(mockSocket2.send).toHaveBeenCalled();
    });
  });

  describe('room management', () => {
    it('should join room', () => {
      const mockSocket = { send: jest.fn(), close: jest.fn() };
      const client = createWebSocketClient(mockSocket, 'client1');

      (gateway as any).handleConnection(client);

      gateway.joinRoom('client1', 'room1');

      expect(gateway.getClientRooms('client1')).toContain('room1');
      expect(gateway.getRoomClients('room1')).toContain('client1');

      const stats = gateway.getStats();
      expect(stats.totalRooms).toBe(1);
    });

    it('should not join room for non-existent client', () => {
      gateway.joinRoom('non-existent', 'room1');
      expect(gateway.getRoomClients('room1')).toHaveLength(0);
    });

    it('should leave room', () => {
      const mockSocket = { send: jest.fn(), close: jest.fn() };
      const client = createWebSocketClient(mockSocket, 'client1');

      (gateway as any).handleConnection(client);

      gateway.joinRoom('client1', 'room1');
      expect(gateway.getClientRooms('client1')).toContain('room1');

      gateway.leaveRoom('client1', 'room1');
      expect(gateway.getClientRooms('client1')).not.toContain('room1');
    });

    it('should not leave room for non-existent client', () => {
      gateway.leaveRoom('non-existent', 'room1');
      // Should not throw
    });

    it('should get room clients', () => {
      const mockSocket1 = { send: jest.fn(), close: jest.fn() };
      const mockSocket2 = { send: jest.fn(), close: jest.fn() };
      const client1 = createWebSocketClient(mockSocket1, 'client1');
      const client2 = createWebSocketClient(mockSocket2, 'client2');

      (gateway as any).handleConnection(client1);
      (gateway as any).handleConnection(client2);

      gateway.joinRoom('client1', 'room1');
      gateway.joinRoom('client2', 'room1');

      const clients = gateway.getRoomClients('room1');
      expect(clients).toHaveLength(2);
      expect(clients).toContain('client1');
      expect(clients).toContain('client2');
    });

    it('should get client rooms', () => {
      const mockSocket = { send: jest.fn(), close: jest.fn() };
      const client = createWebSocketClient(mockSocket, 'client1');

      (gateway as any).handleConnection(client);

      gateway.joinRoom('client1', 'room1');
      gateway.joinRoom('client1', 'room2');

      const rooms = gateway.getClientRooms('client1');
      expect(rooms).toHaveLength(2);
      expect(rooms).toContain('room1');
      expect(rooms).toContain('room2');
    });
  });

  describe('disconnection', () => {
    it('should disconnect specific client', () => {
      const mockSocket = { send: jest.fn(), close: jest.fn() };
      const client = createWebSocketClient(mockSocket, 'client1');

      (gateway as any).handleConnection(client);
      gateway.joinRoom('client1', 'room1');

      expect(gateway.getClientCount()).toBe(1);

      gateway.disconnectClient('client1');

      expect(gateway.getClientCount()).toBe(0);
      expect(mockSocket.close).toHaveBeenCalled();
    });

    it('should not disconnect non-existent client', () => {
      gateway.disconnectClient('non-existent');
      // Should not throw
    });

    it('should disconnect all clients', () => {
      const mockSocket1 = { send: jest.fn(), close: jest.fn() };
      const mockSocket2 = { send: jest.fn(), close: jest.fn() };
      const client1 = createWebSocketClient(mockSocket1, 'client1');
      const client2 = createWebSocketClient(mockSocket2, 'client2');

      (gateway as any).handleConnection(client1);
      (gateway as any).handleConnection(client2);

      gateway.disconnectAll();

      expect(gateway.getClientCount()).toBe(0);
      expect(mockSocket1.close).toHaveBeenCalled();
      expect(mockSocket2.close).toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should get stats', () => {
      const stats = gateway.getStats();

      expect(stats).toBeDefined();
      expect(stats.connectedClients).toBe(0);
      expect(stats.totalRooms).toBe(0);
      expect(stats.messagesSent).toBe(0);
      expect(stats.messagesReceived).toBe(0);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should update stats correctly', () => {
      const mockSocket = { send: jest.fn(), close: jest.fn() };
      const client = createWebSocketClient(mockSocket, 'client1');

      (gateway as any).handleConnection(client);
      gateway.sendToClient('client1', 'test', {});
      gateway.joinRoom('client1', 'room1');

      const stats = gateway.getStats();
      expect(stats.connectedClients).toBe(1);
      expect(stats.totalRooms).toBe(1);
      expect(stats.messagesSent).toBe(1);
    });
  });
});

describe('WebSocket Decorators', () => {
  describe('@Realtime', () => {
    it('should mark class as realtime gateway', () => {
      @Realtime('/test')
      class TestGateway {}

      const metadata = getRealtimeMetadata(TestGateway);
      expect(metadata).toBeDefined();
      expect(metadata?.path).toBe('/test');
      expect(isRealtimeGateway(TestGateway)).toBe(true);
    });

    it('should accept options object', () => {
      @Realtime({ path: '/test', auth: true })
      class TestGateway {}

      const metadata = getRealtimeMetadata(TestGateway);
      expect(metadata?.path).toBe('/test');
      expect(metadata?.auth).toBe(true);
    });

    it('should use default options when no argument provided', () => {
      @Realtime()
      class TestGateway {}

      const metadata = getRealtimeMetadata(TestGateway);
      expect(metadata).toBeDefined();
      expect(metadata?.path).toBe('/');
    });

    it('should return false for non-realtime gateway', () => {
      class RegularClass {}
      expect(isRealtimeGateway(RegularClass)).toBe(false);
    });
  });

  describe('@Subscribe', () => {
    it('should store subscribe metadata', () => {
      class TestGateway {
        @Subscribe('test-event')
        handleEvent() {}
      }

      const instance = new TestGateway();
      const metadata = getSubscribeMetadata(instance, 'handleEvent');
      expect(metadata).toBe('test-event');
    });
  });

  describe('@OnConnect', () => {
    it('should store onconnect metadata', () => {
      class TestGateway {
        @OnConnect()
        handleConnect() {}
      }

      const instance = new TestGateway();
      const metadata = getOnConnectMetadata(instance, 'handleConnect');
      expect(metadata).toBe(true);
    });

    it('should return false when metadata not found', () => {
      class TestGateway {
        handleConnect() {}
      }

      const instance = new TestGateway();
      const metadata = getOnConnectMetadata(instance, 'handleConnect');
      expect(metadata).toBe(false);
    });
  });

  describe('@OnDisconnect', () => {
    it('should store ondisconnect metadata', () => {
      class TestGateway {
        @OnDisconnect()
        handleDisconnect() {}
      }

      const instance = new TestGateway();
      const metadata = getOnDisconnectMetadata(instance, 'handleDisconnect');
      expect(metadata).toBe(true);
    });
  });

  describe('@OnMessage', () => {
    it('should store onmessage metadata', () => {
      class TestGateway {
        @OnMessage('chat')
        handleMessage() {}
      }

      const instance = new TestGateway();
      const metadata = getOnMessageMetadata(instance, 'handleMessage');
      expect(metadata).toBe('chat');
    });

    it('should return undefined when metadata not found', () => {
      class TestGateway {
        handleMessage() {}
      }

      const instance = new TestGateway();
      const metadata = getOnMessageMetadata(instance, 'handleMessage');
      expect(metadata).toBeUndefined();
    });
  });

  describe('@Client', () => {
    it('should store client parameter metadata', () => {
      class TestGateway {
        handleConnection(@Client() _client: any) {}
      }

      const instance = new TestGateway();
      const metadata = getParameterMetadata(instance, 'handleConnection');
      expect(metadata).toContain('client');
    });
  });

  describe('@Data', () => {
    it('should store data parameter metadata', () => {
      class TestGateway {
        handleMessage(@Data() _data: any) {}
      }

      const instance = new TestGateway();
      const metadata = getParameterMetadata(instance, 'handleMessage');
      expect(metadata).toContain('data');
    });
  });

  describe('parameter decorators combination', () => {
    it('should handle multiple parameter decorators', () => {
      class TestGateway {
        handleMessage(@Client() _client: any, @Data() _data: any) {}
      }

      const instance = new TestGateway();
      const metadata = getParameterMetadata(instance, 'handleMessage');
      expect(metadata[0]).toBe('client');
      expect(metadata[1]).toBe('data');
    });
  });
});

describe('createWebSocketClient', () => {
  it('should create a WebSocket client', () => {
    const mockSocket = {
      send: jest.fn(),
      close: jest.fn(),
    };

    const client = createWebSocketClient(mockSocket, 'test-id');

    expect(client.id).toBe('test-id');
    expect(client.socket).toBe(mockSocket);
    expect(client.metadata).toBeInstanceOf(Map);
    expect(client.rooms).toBeInstanceOf(Set);
  });

  it('should handle join and leave room', () => {
    const mockSocket = { send: jest.fn(), close: jest.fn() };
    const client = createWebSocketClient(mockSocket, 'test-id');

    client.join('room1');
    expect(client.inRoom('room1')).toBe(true);

    client.leave('room1');
    expect(client.inRoom('room1')).toBe(false);
  });

  it('should send message', () => {
    const mockSocket = {
      send: jest.fn(),
      close: jest.fn(),
    };

    const client = createWebSocketClient(mockSocket, 'test-id');
    client.send('test-event', { data: 'test' });

    expect(mockSocket.send).toHaveBeenCalled();
    const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sentMessage.event).toBe('test-event');
    expect(sentMessage.data).toEqual({ data: 'test' });
    expect(sentMessage.timestamp).toBeDefined();
  });

  it('should handle send error gracefully', () => {
    const mockSocket = {
      send: jest.fn().mockImplementation(() => {
        throw new Error('Send failed');
      }),
      close: jest.fn(),
    };

    const client = createWebSocketClient(mockSocket, 'test-id');
    // Should not throw
    expect(() => {
      client.send('test-event', { data: 'test' });
    }).not.toThrow();
  });

  it('should disconnect client', () => {
    const mockSocket = {
      send: jest.fn(),
      close: jest.fn(),
    };

    const client = createWebSocketClient(mockSocket, 'test-id');
    client.disconnect();

    expect(mockSocket.close).toHaveBeenCalled();
  });

  it('should handle disconnect error gracefully', () => {
    const mockSocket = {
      send: jest.fn(),
      close: jest.fn().mockImplementation(() => {
        throw new Error('Close failed');
      }),
    };

    const client = createWebSocketClient(mockSocket, 'test-id');
    // Should not throw
    expect(() => {
      client.disconnect();
    }).not.toThrow();
  });

  it('should handle metadata operations', () => {
    const mockSocket = { send: jest.fn(), close: jest.fn() };
    const client = createWebSocketClient(mockSocket, 'test-id');

    client.metadata.set('key', 'value');
    expect(client.metadata.get('key')).toBe('value');
  });
});
