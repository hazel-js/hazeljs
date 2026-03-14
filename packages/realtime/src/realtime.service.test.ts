import { RealtimeService } from './realtime.service';
import { OpenAIRealtimeSession } from './providers/openai';

jest.mock('./providers/openai', () => ({
  OpenAIRealtimeSession: jest.fn().mockImplementation((client, _options) => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    handleClientMessage: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      sessionId: client.id,
      provider: 'openai',
      connectedAt: Date.now(),
      audioChunksReceived: 0,
      audioChunksSent: 0,
      eventsReceived: 0,
      eventsSent: 0,
    }),
    isConnected: true,
  })),
}));

describe('RealtimeService', () => {
  const mockClient = {
    id: 'client-1',
    send: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('constructor', () => {
    it('should use default provider openai', () => {
      const service = new RealtimeService({});
      expect(service.getSessionCount()).toBe(0);
    });

    it('should use provided options', () => {
      const service = new RealtimeService({
        defaultProvider: 'openai',
        openaiApiKey: 'custom-key',
      });
      expect(service.getSessionCount()).toBe(0);
    });
  });

  describe('createOpenAISession', () => {
    it('should create and return a session', async () => {
      const service = new RealtimeService({ openaiApiKey: 'test-key' });
      const session = await service.createOpenAISession(mockClient);

      expect(session).toBeDefined();
      expect(service.getSession('client-1')).toBe(session);
      expect(service.getSessionCount()).toBe(1);
    });

    it('should throw when OPENAI_API_KEY is missing', async () => {
      const service = new RealtimeService({ openaiApiKey: undefined });
      delete process.env.OPENAI_API_KEY;

      await expect(service.createOpenAISession(mockClient)).rejects.toThrow(
        'OPENAI_API_KEY is required for OpenAI Realtime'
      );
    });

    it('should pass overrides to session', async () => {
      const service = new RealtimeService({ openaiApiKey: 'test-key' });

      await service.createOpenAISession(mockClient, {
        model: 'gpt-4o',
        sessionConfig: { instructions: 'Custom instructions' },
      });

      expect(OpenAIRealtimeSession as jest.Mock).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          apiKey: 'test-key',
          model: 'gpt-4o',
          sessionConfig: { instructions: 'Custom instructions' },
        })
      );
    });
  });

  describe('getSession', () => {
    it('should return session when exists', async () => {
      const service = new RealtimeService({ openaiApiKey: 'test-key' });
      const session = await service.createOpenAISession(mockClient);

      expect(service.getSession('client-1')).toBe(session);
    });

    it('should return undefined when session does not exist', () => {
      const service = new RealtimeService({ openaiApiKey: 'test-key' });
      expect(service.getSession('non-existent')).toBeUndefined();
    });
  });

  describe('removeSession', () => {
    it('should remove and disconnect session', async () => {
      const service = new RealtimeService({ openaiApiKey: 'test-key' });
      const session = await service.createOpenAISession(mockClient);
      const disconnectSpy = jest.spyOn(session, 'disconnect');

      service.removeSession('client-1');

      expect(disconnectSpy).toHaveBeenCalled();
      expect(service.getSession('client-1')).toBeUndefined();
      expect(service.getSessionCount()).toBe(0);
    });

    it('should do nothing when session does not exist', () => {
      const service = new RealtimeService({ openaiApiKey: 'test-key' });
      expect(() => service.removeSession('non-existent')).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return stats for all sessions', async () => {
      const service = new RealtimeService({ openaiApiKey: 'test-key' });
      await service.createOpenAISession(mockClient);

      const stats = service.getStats();
      expect(stats).toHaveLength(1);
      expect(stats[0]).toMatchObject({
        clientId: 'client-1',
        sessionId: 'client-1',
        provider: 'openai',
      });
    });

    it('should return empty array when no sessions', () => {
      const service = new RealtimeService({ openaiApiKey: 'test-key' });
      expect(service.getStats()).toEqual([]);
    });
  });

  describe('getSessionCount', () => {
    it('should return correct count', async () => {
      const service = new RealtimeService({ openaiApiKey: 'test-key' });
      expect(service.getSessionCount()).toBe(0);

      await service.createOpenAISession(mockClient);
      expect(service.getSessionCount()).toBe(1);

      const mockClient2 = { id: 'client-2', send: jest.fn() };
      await service.createOpenAISession(mockClient2);
      expect(service.getSessionCount()).toBe(2);

      service.removeSession('client-1');
      expect(service.getSessionCount()).toBe(1);
    });
  });
});
