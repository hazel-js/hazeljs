import { NotificationGateway } from './notification.gateway';
import { WebSocketClient } from '@hazeljs/websocket';

describe('NotificationGateway', () => {
  let gateway: NotificationGateway;
  let mockClient: WebSocketClient;

  beforeEach(() => {
    gateway = new NotificationGateway();

    // Create mock WebSocket client
    mockClient = {
      id: 'test-client-123',
      socket: {},
      metadata: new Map(),
      rooms: new Set(),
      send: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      inRoom: jest.fn((room: string) => mockClient.rooms.has(room)),
    };
  });

  describe('handleConnection', () => {
    it('should handle client connection', () => {
      gateway.handleConnection(mockClient);

      expect(mockClient.send).toHaveBeenCalledWith('connected', {
        message: 'Welcome to notifications!',
        clientId: 'test-client-123',
        timestamp: expect.any(String),
      });
    });

    it('should send welcome message with correct structure', () => {
      gateway.handleConnection(mockClient);

      const call = (mockClient.send as jest.Mock).mock.calls[0];
      expect(call[0]).toBe('connected');
      expect(call[1]).toHaveProperty('message');
      expect(call[1]).toHaveProperty('clientId');
      expect(call[1]).toHaveProperty('timestamp');
    });

    it('should include client ID in welcome message', () => {
      gateway.handleConnection(mockClient);

      const call = (mockClient.send as jest.Mock).mock.calls[0];
      expect(call[1].clientId).toBe('test-client-123');
    });
  });

  describe('handleDisconnect', () => {
    it('should handle client disconnection', () => {
      // This method just logs, so we verify it doesn't throw
      expect(() => {
        gateway.handleDisconnect(mockClient);
      }).not.toThrow();
    });

    it('should be called with correct client', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      gateway.handleDisconnect(mockClient);

      expect(consoleSpy).toHaveBeenCalledWith('Client disconnected:', 'test-client-123');

      consoleSpy.mockRestore();
    });
  });

  describe('onUserNotification', () => {
    it('should subscribe user to notifications', () => {
      const data = { userId: 'user-456' };

      gateway.onUserNotification(mockClient, data);

      expect(mockClient.send).toHaveBeenCalledWith('subscribed', {
        userId: 'user-456',
        message: 'Subscribed to notifications for user user-456',
      });
    });

    it('should join user-specific room', () => {
      const data = { userId: 'user-789' };
      const joinRoomSpy = jest.spyOn(gateway, 'joinRoom');

      gateway.onUserNotification(mockClient, data);

      expect(joinRoomSpy).toHaveBeenCalledWith('test-client-123', 'user-user-789');
    });

    it('should handle different user IDs', () => {
      const data1 = { userId: 'user-1' };
      const data2 = { userId: 'user-2' };

      gateway.onUserNotification(mockClient, data1);
      gateway.onUserNotification(mockClient, data2);

      expect(mockClient.send).toHaveBeenCalledTimes(2);
      expect((mockClient.send as jest.Mock).mock.calls[0][1].userId).toBe('user-1');
      expect((mockClient.send as jest.Mock).mock.calls[1][1].userId).toBe('user-2');
    });

    it('should log subscription', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const data = { userId: 'user-123' };

      gateway.onUserNotification(mockClient, data);

      expect(consoleSpy).toHaveBeenCalledWith('User user-123 subscribed to notifications');

      consoleSpy.mockRestore();
    });
  });

  describe('sendToUser', () => {
    it('should send notification to specific user', () => {
      const broadcastSpy = jest.spyOn(gateway, 'broadcastToRoom');
      const notification = {
        title: 'Test Notification',
        message: 'This is a test',
      };

      gateway.sendToUser('user-123', notification);

      expect(broadcastSpy).toHaveBeenCalledWith('user-user-123', 'notification', notification);
    });

    it('should handle different notification types', () => {
      const broadcastSpy = jest.spyOn(gateway, 'broadcastToRoom');

      const notification1 = { type: 'info', message: 'Info message' };
      const notification2 = { type: 'warning', message: 'Warning message' };

      gateway.sendToUser('user-1', notification1);
      gateway.sendToUser('user-2', notification2);

      expect(broadcastSpy).toHaveBeenCalledTimes(2);
      expect(broadcastSpy).toHaveBeenNthCalledWith(1, 'user-user-1', 'notification', notification1);
      expect(broadcastSpy).toHaveBeenNthCalledWith(2, 'user-user-2', 'notification', notification2);
    });

    it('should handle complex notification objects', () => {
      const broadcastSpy = jest.spyOn(gateway, 'broadcastToRoom');
      const notification = {
        id: 'notif-123',
        title: 'Complex Notification',
        message: 'This is complex',
        metadata: {
          priority: 'high',
          category: 'alert',
        },
        timestamp: new Date().toISOString(),
      };

      gateway.sendToUser('user-456', notification);

      expect(broadcastSpy).toHaveBeenCalledWith('user-user-456', 'notification', notification);
    });
  });

  describe('broadcastNotification', () => {
    it('should broadcast notification to all clients', () => {
      const broadcastSpy = jest.spyOn(gateway, 'broadcast');
      const notification = {
        title: 'Global Announcement',
        message: 'This is for everyone',
      };

      gateway.broadcastNotification(notification);

      expect(broadcastSpy).toHaveBeenCalledWith('notification', notification);
    });

    it('should handle multiple broadcasts', () => {
      const broadcastSpy = jest.spyOn(gateway, 'broadcast');

      const notif1 = { message: 'First broadcast' };
      const notif2 = { message: 'Second broadcast' };

      gateway.broadcastNotification(notif1);
      gateway.broadcastNotification(notif2);

      expect(broadcastSpy).toHaveBeenCalledTimes(2);
      expect(broadcastSpy).toHaveBeenNthCalledWith(1, 'notification', notif1);
      expect(broadcastSpy).toHaveBeenNthCalledWith(2, 'notification', notif2);
    });

    it('should broadcast system notifications', () => {
      const broadcastSpy = jest.spyOn(gateway, 'broadcast');
      const systemNotification = {
        type: 'system',
        title: 'System Maintenance',
        message: 'Server will be down for maintenance',
        scheduledAt: new Date().toISOString(),
      };

      gateway.broadcastNotification(systemNotification);

      expect(broadcastSpy).toHaveBeenCalledWith('notification', systemNotification);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete user flow', () => {
      // 1. Client connects
      gateway.handleConnection(mockClient);
      expect(mockClient.send).toHaveBeenCalledWith('connected', expect.any(Object));

      // 2. Client subscribes to notifications
      gateway.onUserNotification(mockClient, { userId: 'user-123' });
      expect(mockClient.send).toHaveBeenCalledWith('subscribed', expect.any(Object));

      // 3. Send notification to user
      const broadcastSpy = jest.spyOn(gateway, 'broadcastToRoom');
      gateway.sendToUser('user-123', { message: 'Hello!' });
      expect(broadcastSpy).toHaveBeenCalled();

      // 4. Client disconnects
      gateway.handleDisconnect(mockClient);
      expect(mockClient.send).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple clients', () => {
      const client1 = { ...mockClient, id: 'client-1', send: jest.fn() };
      const client2 = { ...mockClient, id: 'client-2', send: jest.fn() };

      gateway.handleConnection(client1 as any);
      gateway.handleConnection(client2 as any);

      expect(client1.send).toHaveBeenCalled();
      expect(client2.send).toHaveBeenCalled();
    });

    it('should handle user subscribing to multiple rooms', () => {
      const joinRoomSpy = jest.spyOn(gateway, 'joinRoom');

      gateway.onUserNotification(mockClient, { userId: 'user-1' });
      gateway.onUserNotification(mockClient, { userId: 'user-2' });

      expect(joinRoomSpy).toHaveBeenCalledTimes(2);
      expect(joinRoomSpy).toHaveBeenCalledWith('test-client-123', 'user-user-1');
      expect(joinRoomSpy).toHaveBeenCalledWith('test-client-123', 'user-user-2');
    });
  });

  describe('error handling', () => {
    it('should handle missing userId gracefully', () => {
      const data = {}; // Missing userId

      expect(() => {
        gateway.onUserNotification(mockClient, data);
      }).not.toThrow();
    });

    it('should handle null notification data', () => {
      const broadcastSpy = jest.spyOn(gateway, 'broadcast');

      expect(() => {
        gateway.broadcastNotification(null as any);
      }).not.toThrow();

      expect(broadcastSpy).toHaveBeenCalledWith('notification', null);
    });

    it('should handle undefined userId', () => {
      const broadcastSpy = jest.spyOn(gateway, 'broadcastToRoom');

      expect(() => {
        gateway.sendToUser(undefined as any, { message: 'test' });
      }).not.toThrow();
    });
  });

  describe('notification content validation', () => {
    it('should handle string notifications', () => {
      const broadcastSpy = jest.spyOn(gateway, 'broadcast');

      gateway.broadcastNotification('Simple string notification');

      expect(broadcastSpy).toHaveBeenCalledWith('notification', 'Simple string notification');
    });

    it('should handle array notifications', () => {
      const broadcastSpy = jest.spyOn(gateway, 'broadcast');
      const notifications = [
        { id: 1, message: 'First' },
        { id: 2, message: 'Second' },
      ];

      gateway.broadcastNotification(notifications);

      expect(broadcastSpy).toHaveBeenCalledWith('notification', notifications);
    });

    it('should handle nested object notifications', () => {
      const notification = {
        user: {
          id: 'user-123',
          name: 'John Doe',
        },
        notification: {
          type: 'message',
          content: {
            subject: 'Hello',
            body: 'World',
          },
        },
      };

      const broadcastSpy = jest.spyOn(gateway, 'broadcast');
      gateway.broadcastNotification(notification);

      expect(broadcastSpy).toHaveBeenCalledWith('notification', notification);
    });
  });
});
