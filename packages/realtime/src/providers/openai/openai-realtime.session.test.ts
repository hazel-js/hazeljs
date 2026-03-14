import { OpenAIRealtimeSession } from './openai-realtime.session';
import { OpenAIRealtimeClient } from './openai-realtime.client';

const mockClientConnect = jest.fn().mockResolvedValue(undefined);
const mockClientSend = jest.fn();
const mockClientDisconnect = jest.fn();

jest.mock('./openai-realtime.client', () => ({
  OpenAIRealtimeClient: jest.fn().mockImplementation(() => ({
    connect: mockClientConnect,
    send: jest.fn(),
    appendAudio: jest.fn(),
    addConversationItem: jest.fn(),
    createResponse: jest.fn(),
    onAny: jest.fn((handler: (e: unknown) => void) => {
      mockOnAnyHandler = handler;
      return () => {};
    }),
    disconnect: mockClientDisconnect,
    connected: true,
  })),
}));

let mockOnAnyHandler: ((e: unknown) => void) | null = null;

describe('OpenAIRealtimeSession', () => {
  const mockHazelClient = {
    id: 'session-1',
    send: mockClientSend,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnAnyHandler = null;
  });

  describe('connect', () => {
    it('should connect the underlying client', async () => {
      const session = new OpenAIRealtimeSession(mockHazelClient, {
        apiKey: 'test-key',
      });

      await session.connect();

      expect(mockClientConnect).toHaveBeenCalled();
    });

    it('should forward server events to hazel client via onAny', async () => {
      const session = new OpenAIRealtimeSession(mockHazelClient, {
        apiKey: 'test-key',
      });
      await session.connect();

      expect(mockOnAnyHandler).toBeDefined();
      mockOnAnyHandler!({ type: 'session.created', session: { id: 's1' } });

      expect(mockClientSend).toHaveBeenCalledWith('realtime', {
        type: 'session.created',
        session: { id: 's1' },
      });
    });
  });

  describe('handleClientMessage', () => {
    it('should forward valid OpenAI events to client', async () => {
      const session = new OpenAIRealtimeSession(mockHazelClient, {
        apiKey: 'test-key',
      });
      await session.connect();

      session.handleClientMessage({
        type: 'input_audio_buffer.append',
        audio: 'base64data',
      });

      const clientInstance = (OpenAIRealtimeClient as jest.Mock).mock.results[0]?.value;
      expect(clientInstance.send).toHaveBeenCalledWith({
        type: 'input_audio_buffer.append',
        audio: 'base64data',
      });
    });

    it('should ignore non-object payload', async () => {
      const session = new OpenAIRealtimeSession(mockHazelClient, {
        apiKey: 'test-key',
      });
      await session.connect();

      session.handleClientMessage(null);
      session.handleClientMessage('string');
      session.handleClientMessage(123);

      const clientInstance = (OpenAIRealtimeClient as jest.Mock).mock.results[0]?.value;
      expect(clientInstance.send).not.toHaveBeenCalled();
    });

    it('should ignore payload without type', async () => {
      const session = new OpenAIRealtimeSession(mockHazelClient, {
        apiKey: 'test-key',
      });
      await session.connect();

      session.handleClientMessage({ data: 'no type' });

      const clientInstance = (OpenAIRealtimeClient as jest.Mock).mock.results[0]?.value;
      expect(clientInstance.send).not.toHaveBeenCalled();
    });
  });

  describe('appendAudio', () => {
    it('should call client appendAudio', async () => {
      const session = new OpenAIRealtimeSession(mockHazelClient, {
        apiKey: 'test-key',
      });
      await session.connect();

      session.appendAudio('base64chunk');

      const clientInstance = (OpenAIRealtimeClient as jest.Mock).mock.results[0]?.value;
      expect(clientInstance.appendAudio).toHaveBeenCalledWith('base64chunk');
    });
  });

  describe('sendText', () => {
    it('should add conversation item and create response', async () => {
      const session = new OpenAIRealtimeSession(mockHazelClient, {
        apiKey: 'test-key',
      });
      await session.connect();

      session.sendText('Hello world');

      const clientInstance = (OpenAIRealtimeClient as jest.Mock).mock.results[0]?.value;
      expect(clientInstance.addConversationItem).toHaveBeenCalledWith('Hello world');
      expect(clientInstance.createResponse).toHaveBeenCalledWith({
        outputModalities: ['audio', 'text'],
      });
    });
  });

  describe('getStats', () => {
    it('should return session stats', async () => {
      const session = new OpenAIRealtimeSession(mockHazelClient, {
        apiKey: 'test-key',
      });
      await session.connect();

      const stats = session.getStats();

      expect(stats).toMatchObject({
        sessionId: 'session-1',
        provider: 'openai',
      });
      expect(stats.connectedAt).toBeDefined();
    });
  });

  describe('disconnect', () => {
    it('should disconnect the client', async () => {
      const session = new OpenAIRealtimeSession(mockHazelClient, {
        apiKey: 'test-key',
      });
      await session.connect();

      session.disconnect();

      expect(mockClientDisconnect).toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('should return client connected state', async () => {
      const session = new OpenAIRealtimeSession(mockHazelClient, {
        apiKey: 'test-key',
      });
      await session.connect();

      expect(session.isConnected).toBe(true);
    });
  });
});
