import {
  getOnConnectMetadata,
  getOnDisconnectMetadata,
  getOnMessageMetadata,
  getParameterMetadata,
  getSubscribeMetadata,
} from './decorators/realtime.decorator';
import type { WebSocketClient, WebSocketMessage } from './websocket.types';

/**
 * Resolves and invokes @OnConnect / @OnDisconnect / @OnMessage / @Subscribe
 * handlers using Reflect metadata. Called by WebSocketGateway lifecycle hooks
 * so apps do not need custom dispatch boilerplate.
 */

function methodNames(proto: object): string[] {
  return Object.getOwnPropertyNames(proto).filter((name) => {
    if (name === 'constructor') return false;
    return typeof (proto as Record<string, unknown>)[name] === 'function';
  });
}

function buildArgs(
  target: object,
  methodName: string,
  client: WebSocketClient,
  data: unknown
): unknown[] {
  const params = getParameterMetadata(target, methodName);
  if (params.length === 0) {
    return [client, data];
  }
  return params.map((kind) => {
    if (kind === 'client') return client;
    if (kind === 'data') return data;
    return undefined;
  });
}

function sendHandlerError(client: WebSocketClient, err: unknown): void {
  try {
    client.send('error', {
      message: err instanceof Error ? err.message : 'WebSocket handler error',
    });
  } catch {
    // Ignore secondary send failures.
  }
}

function invoke(
  gateway: object,
  proto: object,
  name: string,
  client: WebSocketClient,
  data: unknown
): void {
  const fn = (gateway as Record<string, (...args: unknown[]) => unknown>)[name];
  if (typeof fn !== 'function') return;
  const args = buildArgs(proto, name, client, data);
  try {
    void Promise.resolve(fn.apply(gateway, args)).catch((err) => sendHandlerError(client, err));
  } catch (err) {
    // Handler errors should not tear down the socket connection.
    sendHandlerError(client, err);
  }
}

export function dispatchOnConnect(gateway: object, client: WebSocketClient): void {
  const proto = Object.getPrototypeOf(gateway) as object;
  for (const name of methodNames(proto)) {
    if (!getOnConnectMetadata(proto, name)) continue;
    invoke(gateway, proto, name, client, undefined);
  }
}

export function dispatchOnDisconnect(gateway: object, client: WebSocketClient): void {
  const proto = Object.getPrototypeOf(gateway) as object;
  for (const name of methodNames(proto)) {
    if (!getOnDisconnectMetadata(proto, name)) continue;
    invoke(gateway, proto, name, client, undefined);
  }
}

export function dispatchOnMessage(
  gateway: object,
  client: WebSocketClient,
  message: WebSocketMessage
): void {
  const proto = Object.getPrototypeOf(gateway) as object;
  for (const name of methodNames(proto)) {
    const event = getOnMessageMetadata(proto, name) ?? getSubscribeMetadata(proto, name);
    if (!event || event !== message.event) continue;
    invoke(gateway, proto, name, client, message.data);
  }
}
