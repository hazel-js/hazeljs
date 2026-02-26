/**
 * API Gateway - Config-Driven Microservices Example
 *
 * Demonstrates @hazeljs/gateway with config-driven routing:
 *   - All route definitions come from gateway.config.ts + env vars
 *   - Canary weights, thresholds, versions are configurable per environment
 *   - No hardcoded values in decorators
 *
 * To change gateway behavior without redeploying, set env vars:
 *   ORDER_CANARY_WEIGHT=20          -> send 20% to canary
 *   ORDER_CANARY_ERROR_THRESHOLD=3  -> rollback at 3% error rate
 *   USER_SVC_RATE_LIMIT_MAX=200     -> increase user service rate limit
 *
 * See gateway.config.ts for the full list of configurable env vars.
 */

import * as http from 'http';
import { ConfigModule, ConfigService } from '@hazeljs/config';
import { ServiceRegistry } from '@hazeljs/discovery';
import { GatewayServer, GatewayModule } from '@hazeljs/gateway';
import { sharedBackend } from './shared-registry';
import gatewayConfig from './gateway.config';

// ─── Start the Gateway ───

async function startAPIGateway() {
  const port = parseInt(process.env.GATEWAY_PORT || process.env.PORT || '3003');
  const zone = process.env.ZONE || 'us-east-1';
  const startTime = Date.now();

  // 1. Register ConfigModule with the gateway config loader
  ConfigModule.forRoot({
    envFilePath: ['.env', '.env.local'],
    isGlobal: true,
    load: [gatewayConfig],
  });

  // 2. Register GatewayModule and resolve config
  GatewayModule.forRoot({ configKey: 'gateway' });
  const configService = new ConfigService();
  const gwConfig = GatewayModule.resolveConfig(configService);

  // 3. Create the gateway server from config
  const gateway = GatewayServer.fromConfig(gwConfig, sharedBackend);

  gateway.on('canary:promote', (data) => {
    console.log(`🟢 Canary promoted: step ${data.step}/${data.totalSteps}, canary weight: ${data.canaryWeight}%`);
  });
  gateway.on('canary:rollback', (data) => {
    console.log(`🔴 Canary rolled back: ${data.canaryVersion} -> ${data.stableVersion} (trigger: ${data.trigger})`);
  });
  gateway.on('canary:complete', (data) => {
    console.log(`✅ Canary complete: ${data.version} is now receiving 100% traffic`);
  });

  gateway.startCanaries();

  // 4. Create HTTP server: /health and /gateway/* are handled here; everything else goes to the gateway proxy
  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    const [pathname, search] = url.split('?');
    const method = req.method || 'GET';

    // Parse query string
    const query: Record<string, string> = {};
    if (search) {
      for (const part of search.split('&')) {
        const [k, v] = part.split('=').map(decodeURIComponent);
        if (k) query[k] = v || '';
      }
    }

    // Built-in: health
    if (pathname === '/health' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'UP',
          timestamp: new Date().toISOString(),
          service: 'api-gateway',
          uptime: Date.now() - startTime,
        })
      );
      return;
    }

    // Built-in: gateway routes info
    if (pathname === '/gateway/routes' && method === 'GET') {
      try {
        const config = GatewayModule.resolveConfig(configService);
        const body = {
          totalRoutes: config.routes.length,
          routes: config.routes.map((r) => ({
            path: r.path,
            service: r.serviceName,
            hasCanary: !!r.canary,
            hasVersionRouting: !!r.versionRoute,
            hasCircuitBreaker: !!r.circuitBreaker,
            hasRateLimit: !!r.rateLimit,
            hasMirror: !!r.trafficPolicy?.mirror,
          })),
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            statusCode: 500,
            message: err instanceof Error ? err.message : 'Failed to resolve gateway config',
          })
        );
      }
      return;
    }

    // All other requests: read body then proxy through the gateway
    const runProxy = (body: unknown) => {
      const headers: Record<string, string | string[] | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (v !== undefined) headers[k] = v;
      }
      const proxyRequest = { method, path: pathname, headers, body, query };

      // Defer proxy to next tick so the same-process backend (user/order service)
      // can run when we await the outbound request — avoids same-process deadlock.
      setImmediate(async () => {
        try {
          const proxyResponse = await gateway.handleRequest(proxyRequest);
          if (res.writableEnded) return;
          res.writeHead(proxyResponse.status, proxyResponse.headers);
          const out =
            typeof proxyResponse.body === 'object' && proxyResponse.body !== null
              ? JSON.stringify(proxyResponse.body)
              : String(proxyResponse.body ?? '');
          res.end(out);
        } catch (err) {
          if (res.writableEnded) return;
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              statusCode: 502,
              message: err instanceof Error ? err.message : 'Bad Gateway',
            })
          );
        }
      });
    };

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        let body: unknown = undefined;
        const raw = Buffer.concat(chunks).toString();
        if (raw) {
          const contentType = req.headers['content-type'] || '';
          if (contentType.includes('application/json')) {
            try {
              body = JSON.parse(raw);
            } catch {
              body = raw;
            }
          } else {
            body = raw;
          }
        }
        runProxy(body);
      });
      req.on('error', (err: NodeJS.ErrnoException) => {
        const isClientAbort =
          err?.message === 'aborted' || err?.code === 'ECONNRESET' || err?.code === 'EPIPE';
        if (isClientAbort || res.writableEnded) return;
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ statusCode: 400, message: 'Invalid request body' }));
      });
    } else {
      runProxy(undefined);
    }
  });

  server.listen(port, () => {
    console.log(`✅ API Gateway started on port ${port}`);
  });

  // Register in service registry
  const registry = new ServiceRegistry(
    {
      name: 'api-gateway',
      port,
      host: process.env.GATEWAY_HOST || 'localhost',
      healthCheckPath: '/health',
      healthCheckInterval: parseInt(process.env.GATEWAY_HEALTH_INTERVAL || '30000'),
      metadata: {
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      zone,
      tags: ['gateway', 'api', 'microservice'],
    },
    sharedBackend
  );

  registry.register().then(() => {
    console.log(`✅ API Gateway registered in zone: ${zone}`);
  });

  const discoveryClient = gateway.getDiscoveryClient();
  discoveryClient.getAllServices().then((services) => {
    console.log(`🔍 Discovered ${services.length} service(s): ${services.join(', ')}`);
  });

  console.log('\n📡 API Gateway Routes (from config):');
  for (const route of gateway.getRoutes()) {
    console.log(`  ${route}`);
  }
  console.log(`  GET http://localhost:${port}/health`);
  console.log(`  GET http://localhost:${port}/gateway/routes\n`);

  const shutdown = async () => {
    console.log('\n🛑 Shutting down API Gateway...');
    gateway.stop();
    server.close();
    await registry.deregister();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start the gateway
if (require.main === module) {
  startAPIGateway().catch((error) => {
    console.error('❌ Failed to start API Gateway:', error);
    process.exit(1);
  });
}

export { startAPIGateway };
