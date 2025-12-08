import {
  Realtime,
  Subscribe,
  OnConnect,
  OnDisconnect,
  Client,
  Data,
  WebSocketGateway,
} from '@hazeljs/websocket';
import type { WebSocketClient } from '@hazeljs/websocket';

/**
 * Notification gateway for real-time updates
 */
@Realtime('/notifications')
export class NotificationGateway extends WebSocketGateway {
  /**
   * Handle client connection
   */
  @OnConnect()
  handleConnection(@Client() client: WebSocketClient) {
    console.log('Client connected:', client.id);

    // Send welcome message
    client.send('connected', {
      message: 'Welcome to notifications!',
      clientId: client.id,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle client disconnection
   */
  @OnDisconnect()
  handleDisconnect(@Client() client: WebSocketClient) {
    console.log('Client disconnected:', client.id);
  }

  /**
   * Subscribe to user notifications
   */
  @Subscribe('user-{userId}')
  onUserNotification(@Client() client: WebSocketClient, @Data() data: any) {
    const userId = data.userId;
    console.log(`User ${userId} subscribed to notifications`);

    // Join user-specific room
    this.joinRoom(client.id, `user-${userId}`);

    // Send confirmation
    client.send('subscribed', {
      userId,
      message: `Subscribed to notifications for user ${userId}`,
    });
  }

  /**
   * Send notification to a specific user
   */
  sendToUser(userId: string, notification: any) {
    this.broadcastToRoom(`user-${userId}`, 'notification', notification);
  }

  /**
   * Broadcast notification to all connected clients
   */
  broadcastNotification(notification: any) {
    this.broadcast('notification', notification);
  }
}
