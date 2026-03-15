/**
 * InspectorModule - Registers inspector with HazelApp
 */

import fs from 'fs';
import path from 'path';
import { Container, HazelApp, Injectable, Inject } from '@hazeljs/core';
import type { DynamicModule } from '@hazeljs/core';
import type { InspectorContext, InspectorModuleOptions } from './contracts/types';
import { HazelInspectorRegistry } from './registry/registry';
import { HazelInspectorService } from './service/inspector.service';
import { coreInspector } from './plugins/core.inspector';
import { cronInspector } from './plugins/cron.inspector';
import { queueInspector } from './plugins/queue.inspector';
import { websocketInspector } from './plugins/websocket.inspector';
import { agentInspector } from './plugins/agent.inspector';
import { aiInspector } from './plugins/ai.inspector';
import { ragInspector } from './plugins/rag.inspector';
import { promptsInspector } from './plugins/prompts.inspector';
import { eventEmitterInspector } from './plugins/event-emitter.inspector';
import { graphqlInspector } from './plugins/graphql.inspector';
import { grpcInspector } from './plugins/grpc.inspector';
import { kafkaInspector } from './plugins/kafka.inspector';
import { flowInspector } from './plugins/flow.inspector';
import { dataInspector } from './plugins/data.inspector';
import { serverlessInspector } from './plugins/serverless.inspector';
import { mlInspector } from './plugins/ml.inspector';
import { mergeInspectorConfig, shouldExposeInspector } from './config/inspector.config';
import { InspectorRuntime } from './runtime/inspector-runtime';

/** Eagerly resolves InspectorBootstrap so the early handler gets registered */
@Injectable()
class InspectorBootstrapClass {
  constructor(@Inject('InspectorBootstrap') _result: unknown) {}
}

/**
 * Add InspectorModule.forRoot() to your app imports to enable the inspector.
 *
 * @example
 * ```ts
 * @HazelModule({
 *   imports: [
 *     InspectorModule.forRoot({
 *       inspectorBasePath: '/__hazel',
 *       developmentOnly: true,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
export const InspectorModule = {
  forRoot(options?: InspectorModuleOptions): DynamicModule {
    const config = mergeInspectorConfig(options);

    const inspectorProvider = {
      provide: 'InspectorBootstrap',
      useFactory: (): boolean | null => {
        if (!shouldExposeInspector(config)) return null;

        const container = Container.getInstance();
        const app = container.resolve(HazelApp);
        const registry = new HazelInspectorRegistry();
        const service = new HazelInspectorService(registry, config);

        registry.register(coreInspector);
        registry.register(cronInspector);
        registry.register(queueInspector);
        registry.register(websocketInspector);
        registry.register(agentInspector);
        registry.register(aiInspector);
        registry.register(ragInspector);
        registry.register(promptsInspector);
        registry.register(eventEmitterInspector);
        registry.register(graphqlInspector);
        registry.register(grpcInspector);
        registry.register(kafkaInspector);
        registry.register(flowInspector);
        registry.register(dataInspector);
        registry.register(serverlessInspector);
        registry.register(mlInspector);

        const basePath = config.inspectorBasePath ?? '/__hazel';
        const handler = createInspectorHandler(service, config, app);
        app.addEarlyHandler(basePath, handler);

        return true;
      },
      inject: [],
    };

    return {
      module: class InspectorRootModule {},
      providers: [inspectorProvider, InspectorBootstrapClass],
    };
  },
};

function readJsonBody(req: {
  on: (e: string, cb: (chunk?: Buffer) => void) => void;
}): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk?: Buffer) => chunk && chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function createInspectorHandler(
  service: HazelInspectorService,
  config: ReturnType<typeof mergeInspectorConfig>,
  app: { getContainer: () => unknown; getRouter: () => unknown; getModuleType: () => unknown }
): (
  req: { url?: string; method?: string; on?: (e: string, cb: (chunk?: Buffer) => void) => void },
  res: {
    writeHead: (c: number, h?: Record<string, string>) => void;
    setHeader: (k: string, v: string) => void;
    end: (b?: string) => void;
  }
) => Promise<void> {
  return async (
    req: { url?: string; method?: string; on?: (e: string, cb: (chunk?: Buffer) => void) => void },
    res: {
      writeHead: (c: number, h?: Record<string, string>) => void;
      setHeader: (k: string, v: string) => void;
      end: (b?: string) => void;
    }
  ) => {
    const url = req.url?.split('?')[0] ?? '/';
    const basePath = config.inspectorBasePath ?? '/__hazel';
    const pathSeg = url.replace(basePath, '') || '/';

    try {
      if (pathSeg === '/' || pathSeg === '') {
        if (config.exposeUi) {
          const uiPath = path.join(__dirname, '..', 'ui-dist', 'index.html');
          if (fs.existsSync(uiPath)) {
            res.setHeader('Content-Type', 'text/html');
            res.writeHead(200);
            res.end(fs.readFileSync(uiPath, 'utf-8'));
            return;
          }
        }
      }

      if (config.exposeUi && pathSeg.startsWith('/assets/')) {
        const assetPath = path.join(__dirname, '..', 'ui-dist', pathSeg);
        if (
          fs.existsSync(assetPath) &&
          assetPath.startsWith(path.join(__dirname, '..', 'ui-dist'))
        ) {
          const ext = path.extname(assetPath);
          const types: Record<string, string> = {
            '.js': 'application/javascript',
            '.css': 'text/css',
          };
          res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream');
          res.writeHead(200);
          res.end(fs.readFileSync(assetPath, 'utf-8'));
          return;
        }
      }

      if (pathSeg === '/stats' || pathSeg === '/stats/') {
        const mem = process.memoryUsage();
        const uptime = process.uptime();
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(
          JSON.stringify({
            memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
            uptimeSeconds: Math.floor(uptime),
            nodeVersion: process.version,
            nodeEnv: process.env.NODE_ENV ?? 'development',
            inspectorVersion: '0.2.0-rc.2',
          })
        );
        return;
      }

      if (pathSeg === '/env' || pathSeg === '/env/') {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(
          JSON.stringify({
            nodeVersion: process.version,
            nodeEnv: process.env.NODE_ENV ?? 'development',
            inspectorVersion: '0.2.0-rc.2',
            platform: process.platform,
            arch: process.arch,
          })
        );
        return;
      }

      if (
        (pathSeg === '/prompts/render' || pathSeg === '/prompts/render/') &&
        req.method === 'POST'
      ) {
        const body = await readJsonBody(req as Parameters<typeof readJsonBody>[0]);
        const key = body?.key;
        const variables = body?.variables ?? {};
        if (!key || typeof key !== 'string') {
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing or invalid "key" in request body' }));
          return;
        }
        try {
          const promptsMod = require('@hazeljs/prompts');
          const template = promptsMod.PromptRegistry.get(key);
          const rendered = template.render(variables);
          const tokenEstimate = Math.ceil(rendered.length / 4);
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify({ rendered, tokenEstimate, template: template.template }));
        } catch (err) {
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(400);
          res.end(JSON.stringify({ error: String(err) }));
        }
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      const context: InspectorContext = {
        moduleType: app.getModuleType() as InspectorContext['moduleType'],
        container: app.getContainer() as InspectorContext['container'],
        router: app.getRouter() as InspectorContext['router'],
      };
      const rawSnapshot = await service.collectSnapshot(context);
      // Normalize response so UI never receives non-array entries or non-object summary
      const snapshot = {
        ...rawSnapshot,
        entries: Array.isArray(rawSnapshot?.entries) ? rawSnapshot.entries : [],
        summary:
          rawSnapshot?.summary && typeof rawSnapshot.summary === 'object'
            ? rawSnapshot.summary
            : {},
      };

      // Augment with gateway, discovery, resilience overview when available
      const overview: Record<string, unknown> = {};
      try {
        const [gatewayData, discoveryData, resilienceData] = await Promise.all([
          InspectorRuntime.getGatewayOverview(),
          InspectorRuntime.getDiscoveryOverview(),
          InspectorRuntime.getResilienceOverview(),
        ]);
        if (gatewayData) overview.gateway = gatewayData;
        if (discoveryData) overview.discovery = discoveryData;
        if (resilienceData) overview.resilience = resilienceData;
      } catch {
        // ignore
      }
      if (Object.keys(overview).length > 0) {
        (snapshot as Record<string, unknown>).overview = overview;
      }

      if (pathSeg === '/inspect' || pathSeg === '/inspect/') {
        res.writeHead(200);
        res.end(JSON.stringify(snapshot));
        return;
      }
      if (pathSeg === '/routes' || pathSeg === '/routes/') {
        const routes = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'route');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: routes }));
        return;
      }
      if (pathSeg === '/modules' || pathSeg === '/modules/') {
        const modules = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'module');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: modules }));
        return;
      }
      if (pathSeg === '/providers' || pathSeg === '/providers/') {
        const providers = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'provider');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: providers }));
        return;
      }
      if (pathSeg === '/jobs' || pathSeg === '/jobs/') {
        const jobs = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'cron');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: jobs }));
        return;
      }
      if (pathSeg === '/queues' || pathSeg === '/queues/') {
        const queues = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'queue');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: queues }));
        return;
      }
      if (pathSeg === '/websocket' || pathSeg === '/websocket/') {
        const ws = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'websocket');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: ws }));
        return;
      }
      if (pathSeg === '/agents' || pathSeg === '/agents/') {
        const agents = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'agent');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: agents }));
        return;
      }
      const agentRunMatch = pathSeg.match(/^\/agents\/([^/]+)\/run\/?$/);
      if (agentRunMatch && req.method === 'POST') {
        const agentName = decodeURIComponent(agentRunMatch[1]);
        const body = await readJsonBody(req as Parameters<typeof readJsonBody>[0]);
        const input = typeof body?.input === 'string' ? body.input : JSON.stringify(body ?? {});
        try {
          const { AgentService } = require('@hazeljs/agent');
          const container = app.getContainer() as { resolve: (t: unknown) => unknown };
          const svc = container.resolve(AgentService) as {
            execute?: (name: string, input: string) => Promise<unknown>;
          };
          if (!svc?.execute) {
            res.writeHead(503);
            res.end(
              JSON.stringify({ error: 'AgentService not found. Ensure AgentModule is configured.' })
            );
            return;
          }
          const result = await (
            svc as { execute: (name: string, input: string) => Promise<unknown> }
          ).execute(agentName, input);
          res.writeHead(200);
          res.end(JSON.stringify({ result }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(err) }));
        }
        return;
      }
      if (pathSeg === '/rag' || pathSeg === '/rag/') {
        const rag = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'rag');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: rag }));
        return;
      }
      const ragSearchMatch = pathSeg.match(/^\/rag\/([^/]+)\/search\/?$/);
      if (ragSearchMatch && req.method === 'GET') {
        const _pipeline = decodeURIComponent(ragSearchMatch[1]);
        const q =
          (req.url?.includes('?')
            ? new URL(req.url, 'http://localhost').searchParams.get('q')
            : null) ?? '';
        try {
          const _ragMod = require('@hazeljs/rag');
          const container = app.getContainer() as {
            resolve: (t: unknown) => unknown;
            getTokens?: () => unknown[];
          };
          const tokensRaw = container.getTokens?.() ?? [];
          const tokens = Array.isArray(tokensRaw) ? tokensRaw : [];
          let ragService: {
            search?: (
              query: string,
              opts?: { topK?: number }
            ) => Promise<{ content?: string; score?: number; metadata?: unknown }[]>;
          } | null = null;
          for (const token of tokens) {
            try {
              const svc = container.resolve(token);
              if (svc && typeof (svc as { search?: unknown }).search === 'function') {
                ragService = svc as {
                  search: (
                    query: string,
                    opts?: { topK?: number }
                  ) => Promise<{ content?: string; score?: number; metadata?: unknown }[]>;
                };
                break;
              }
            } catch {
              continue;
            }
          }
          if (!ragService?.search) {
            res.writeHead(503);
            res.end(
              JSON.stringify({
                error: 'RAG service not found. Ensure a RAG pipeline is registered.',
              })
            );
            return;
          }
          const results = await ragService.search(q, { topK: 10 });
          res.writeHead(200);
          res.end(JSON.stringify({ results: results ?? [] }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(err) }));
        }
        return;
      }
      if (pathSeg === '/prompts' || pathSeg === '/prompts/') {
        const prompts = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'prompt');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: prompts }));
        return;
      }
      if (
        (pathSeg === '/prompts/render' || pathSeg === '/prompts/render/') &&
        req.method === 'POST'
      ) {
        const body = await readJsonBody(req as Parameters<typeof readJsonBody>[0]);
        const key = body?.key;
        const variables = body?.variables ?? {};
        if (!key || typeof key !== 'string') {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing or invalid "key" in request body' }));
          return;
        }
        try {
          const promptsMod = require('@hazeljs/prompts');
          const template = promptsMod.PromptRegistry.get(key);
          const rendered = template.render(variables);
          const tokenEstimate = Math.ceil(rendered.length / 4);
          res.writeHead(200);
          res.end(JSON.stringify({ rendered, tokenEstimate, template: template.template }));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: String(err) }));
        }
        return;
      }
      if (pathSeg === '/aifunctions' || pathSeg === '/aifunctions/') {
        const aifunctions = snapshot.entries.filter(
          (e: { kind?: string }) => e.kind === 'aifunction'
        );
        res.writeHead(200);
        res.end(JSON.stringify({ entries: aifunctions }));
        return;
      }
      if (pathSeg === '/events' || pathSeg === '/events/') {
        const events = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'event');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: events }));
        return;
      }
      if (pathSeg === '/graphql' || pathSeg === '/graphql/') {
        const graphql = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'graphql');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: graphql }));
        return;
      }
      if (pathSeg === '/grpc' || pathSeg === '/grpc/') {
        const grpc = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'grpc');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: grpc }));
        return;
      }
      if (pathSeg === '/kafka' || pathSeg === '/kafka/') {
        const kafka = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'kafka');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: kafka }));
        return;
      }
      if (pathSeg === '/flows' || pathSeg === '/flows/') {
        const flows = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'flow');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: flows }));
        return;
      }
      if (pathSeg === '/data' || pathSeg === '/data/') {
        const data = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'data');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: data }));
        return;
      }
      if (pathSeg === '/serverless' || pathSeg === '/serverless/') {
        const serverless = snapshot.entries.filter(
          (e: { kind?: string }) => e.kind === 'serverless'
        );
        res.writeHead(200);
        res.end(JSON.stringify({ entries: serverless }));
        return;
      }
      if (pathSeg === '/ml' || pathSeg === '/ml/') {
        const ml = snapshot.entries.filter((e: { kind?: string }) => e.kind === 'ml');
        res.writeHead(200);
        res.end(JSON.stringify({ entries: ml }));
        return;
      }
      if (pathSeg === '/' || pathSeg === '') {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            inspector: true,
            summary: snapshot.summary,
            endpoints: [
              '/inspect',
              '/routes',
              '/modules',
              '/providers',
              '/jobs',
              '/queues',
              '/websocket',
              '/agents',
              '/rag',
              '/prompts',
              '/aifunctions',
              '/events',
              '/graphql',
              '/grpc',
              '/kafka',
              '/flows',
              '/data',
              '/serverless',
              '/ml',
              '/stats',
            ],
          })
        );
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found', path: pathSeg }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(err) }));
    }
  };
}
