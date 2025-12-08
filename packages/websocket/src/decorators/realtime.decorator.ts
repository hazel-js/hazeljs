import 'reflect-metadata';
import { WebSocketGatewayOptions } from '../websocket.types';
import logger from '@hazeljs/core';

const REALTIME_METADATA_KEY = 'hazel:realtime';
const SUBSCRIBE_METADATA_KEY = 'hazel:subscribe';
const ON_CONNECT_METADATA_KEY = 'hazel:onconnect';
const ON_DISCONNECT_METADATA_KEY = 'hazel:ondisconnect';
const ON_MESSAGE_METADATA_KEY = 'hazel:onmessage';

/**
 * Realtime decorator for WebSocket gateways
 *
 * @example
 * ```typescript
 * @Realtime('/notifications')
 * export class NotificationGateway {
 *   // Gateway methods
 * }
 * ```
 */
export function Realtime(pathOrOptions?: string | WebSocketGatewayOptions): ClassDecorator {
  return (target: object | (new (...args: unknown[]) => object)) => {
    const options: WebSocketGatewayOptions =
      typeof pathOrOptions === 'string' ? { path: pathOrOptions } : pathOrOptions || {};

    const defaults: WebSocketGatewayOptions = {
      path: '/',
      namespace: '/',
      auth: false,
      pingInterval: 25000,
      pingTimeout: 5000,
      maxPayload: 1048576, // 1MB
      ...options,
    };

    const targetName = typeof target === 'function' ? target.name : 'unknown';
    logger.debug(`Marking ${targetName} as realtime gateway with path: ${defaults.path}`);
    Reflect.defineMetadata(REALTIME_METADATA_KEY, defaults, target);
  };
}

/**
 * Get realtime metadata from a class
 */
export function getRealtimeMetadata(
  target: object | (new (...args: unknown[]) => object)
): WebSocketGatewayOptions | undefined {
  return Reflect.getMetadata(REALTIME_METADATA_KEY, target);
}

/**
 * Check if a class is a realtime gateway
 */
export function isRealtimeGateway(target: object | (new (...args: unknown[]) => object)): boolean {
  return Reflect.hasMetadata(REALTIME_METADATA_KEY, target);
}

/**
 * Subscribe decorator for event handlers
 *
 * @example
 * ```typescript
 * @Subscribe('user-{userId}')
 * onUserEvent(@Param('userId') userId: string, @Data() data: any) {
 *   // Handle event
 * }
 * ```
 */
export function Subscribe(event: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(SUBSCRIBE_METADATA_KEY, event, target, propertyKey);
    logger.debug(
      `Subscribe decorator applied to ${target.constructor.name}.${String(propertyKey)} for event: ${event}`
    );
    return descriptor;
  };
}

/**
 * Get subscribe metadata from a method
 */
export function getSubscribeMetadata(
  target: object,
  propertyKey: string | symbol
): string | undefined {
  return Reflect.getMetadata(SUBSCRIBE_METADATA_KEY, target, propertyKey);
}

/**
 * OnConnect decorator for connection handlers
 *
 * @example
 * ```typescript
 * @OnConnect()
 * handleConnection(@Client() client: WebSocketClient) {
 *   console.log('Client connected:', client.id);
 * }
 * ```
 */
export function OnConnect(): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(ON_CONNECT_METADATA_KEY, true, target, propertyKey);
    logger.debug(
      `OnConnect decorator applied to ${target.constructor.name}.${String(propertyKey)}`
    );
    return descriptor;
  };
}

/**
 * Get OnConnect metadata
 */
export function getOnConnectMetadata(target: object, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata(ON_CONNECT_METADATA_KEY, target, propertyKey) || false;
}

/**
 * OnDisconnect decorator for disconnection handlers
 *
 * @example
 * ```typescript
 * @OnDisconnect()
 * handleDisconnect(@Client() client: WebSocketClient) {
 *   console.log('Client disconnected:', client.id);
 * }
 * ```
 */
export function OnDisconnect(): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(ON_DISCONNECT_METADATA_KEY, true, target, propertyKey);
    logger.debug(
      `OnDisconnect decorator applied to ${target.constructor.name}.${String(propertyKey)}`
    );
    return descriptor;
  };
}

/**
 * Get OnDisconnect metadata
 */
export function getOnDisconnectMetadata(target: object, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata(ON_DISCONNECT_METADATA_KEY, target, propertyKey) || false;
}

/**
 * OnMessage decorator for message handlers
 *
 * @example
 * ```typescript
 * @OnMessage('chat')
 * handleMessage(@Client() client: WebSocketClient, @Data() data: any) {
 *   // Handle message
 * }
 * ```
 */
export function OnMessage(event: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(ON_MESSAGE_METADATA_KEY, event, target, propertyKey);
    logger.debug(
      `OnMessage decorator applied to ${target.constructor.name}.${String(propertyKey)} for event: ${event}`
    );
    return descriptor;
  };
}

/**
 * Get OnMessage metadata
 */
export function getOnMessageMetadata(
  target: object,
  propertyKey: string | symbol
): string | undefined {
  return Reflect.getMetadata(ON_MESSAGE_METADATA_KEY, target, propertyKey);
}

/**
 * Client parameter decorator
 *
 * @example
 * ```typescript
 * handleConnection(@Client() client: WebSocketClient) {
 *   // client is injected
 * }
 * ```
 */
export function Client(): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const existingParams = Reflect.getMetadata('hazel:ws:params', target, propertyKey!) || [];
    existingParams[parameterIndex] = 'client';
    Reflect.defineMetadata('hazel:ws:params', existingParams, target, propertyKey!);
  };
}

/**
 * Data parameter decorator
 *
 * @example
 * ```typescript
 * handleMessage(@Data() data: any) {
 *   // data is injected
 * }
 * ```
 */
export function Data(): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const existingParams = Reflect.getMetadata('hazel:ws:params', target, propertyKey!) || [];
    existingParams[parameterIndex] = 'data';
    Reflect.defineMetadata('hazel:ws:params', existingParams, target, propertyKey!);
  };
}

/**
 * Get parameter metadata
 */
export function getParameterMetadata(target: object, propertyKey: string | symbol): string[] {
  return Reflect.getMetadata('hazel:ws:params', target, propertyKey) || [];
}
