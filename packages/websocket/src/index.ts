/**
 * @hazeljs/websocket - WebSocket and SSE module for HazelJS
 */

export { WebSocketModule, type WebSocketModuleOptions } from './websocket.module';
export { WebSocketGateway, createWebSocketClient } from './websocket.gateway';
export {
  Realtime,
  Subscribe,
  OnConnect,
  OnDisconnect,
  OnMessage,
  Client,
  Data,
  getRealtimeMetadata,
  isRealtimeGateway,
  getSubscribeMetadata,
  getOnConnectMetadata,
  getOnDisconnectMetadata,
  getOnMessageMetadata,
  getParameterMetadata,
} from './decorators/realtime.decorator';
export { SSEHandler, createSSEResponse, sendSSEMessage } from './sse/sse.handler';
export { RoomManager } from './room/room.manager';
export {
  type WebSocketClient,
  type WebSocketMessage,
  type WebSocketGatewayOptions,
  type Room,
  type WebSocketEventHandler,
  type ConnectionHandler,
  type DisconnectionHandler,
  type WebSocketServerOptions,
  type SSEOptions,
  type SSEMessage,
  type SubscriptionOptions,
  type WebSocketStats,
} from './websocket.types';

