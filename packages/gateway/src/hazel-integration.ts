/**
 * HazelJS Core Integration
 * Creates a proxy handler for use with HazelApp.addProxyHandler()
 *
 * @example
 * ```typescript
 * import { HazelApp } from '@hazeljs/core';
 * import { GatewayServer, createGatewayHandler } from '@hazeljs/gateway';
 *
 * const gateway = GatewayServer.fromConfig(config);
 * const app = new HazelApp(AppModule);
 * app.addProxyHandler('/api', createGatewayHandler(gateway));
 * app.listen(3000);
 * ```
 */

import { IncomingMessage, ServerResponse } from 'http';
import type { RequestContext } from '@hazeljs/core';
import type { GatewayServer } from './gateway';
import type { ProxyRequest, ProxyResponse } from './types';

/**
 * Create a proxy handler that bridges Node.js HTTP to GatewayServer.handleRequest().
 * Use with HazelApp.addProxyHandler(pathPrefix, createGatewayHandler(gateway)).
 */
export function createGatewayHandler(gateway: GatewayServer) {
  return async function gatewayHandler(
    req: IncomingMessage,
    res: ServerResponse,
    context: RequestContext
  ): Promise<boolean> {
    const proxyRequest = toProxyRequest(req, context);
    const proxyResponse = await gateway.handleRequest(proxyRequest);
    writeProxyResponse(res, proxyResponse);
    return true;
  };
}

function toProxyRequest(req: IncomingMessage, context: RequestContext): ProxyRequest {
  const url = req.url || '/';
  const pathname = url.split('?')[0];

  const headers: Record<string, string> = {};
  if (req.headers) {
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    }
  }

  return {
    method: context.method || req.method || 'GET',
    path: pathname,
    headers,
    body: context.body,
    query: context.query ?? {},
  };
}

function writeProxyResponse(res: ServerResponse, proxyRes: ProxyResponse): void {
  if (res.writableEnded) return;

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(proxyRes.headers)) {
    if (value !== undefined) {
      headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
  }
  if (!headers['content-type']) {
    headers['content-type'] = 'application/json';
  }

  res.writeHead(proxyRes.status, headers);

  if (proxyRes.body !== undefined) {
    const body = typeof proxyRes.body === 'string' ? proxyRes.body : JSON.stringify(proxyRes.body);
    res.end(body);
  } else {
    res.end();
  }
}
