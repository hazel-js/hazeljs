import * as http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import { AuditLog } from './audit';
import { ConfigEncryptor } from './encryption';
import { FilesystemConfigSource, GitConfigSource } from './git-backend';
import { deepMerge } from './merge';
import { resolvePropertySources } from './resolver';
import type { ConfigEnvironment, ConfigServerOptions, ConfigSource } from './types';
import { DEFAULT_LABEL } from './types';

function normalizeProfiles(profiles?: string | string[], fallback?: string[]): string[] {
  if (!profiles || (Array.isArray(profiles) && profiles.length === 0) || profiles === '') {
    return fallback?.length ? fallback : ['default'];
  }
  const list = Array.isArray(profiles) ? profiles : profiles.split(',');
  return list.map((p) => p.trim()).filter(Boolean);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export class ConfigServer {
  private static instance?: ConfigServer;
  private static pendingOptions?: ConfigServerOptions;
  private readonly options: ConfigServerOptions;
  private readonly source: ConfigSource;
  private readonly encryptor: ConfigEncryptor;
  readonly audit: AuditLog;
  private httpServer?: http.Server;
  private refreshTimer?: NodeJS.Timeout;
  private workingDir?: string;
  private version?: string;
  private syncedLabel?: string;
  private started = false;

  static getInstance(): ConfigServer {
    if (!ConfigServer.instance) {
      throw new Error(
        'ConfigServer has not been started. Call ConfigServerModule.forRoot() or `await new ConfigServer(options).start()`.'
      );
    }
    return ConfigServer.instance;
  }

  static resetInstance(): void {
    ConfigServer.instance = undefined;
  }

  static configure(options: ConfigServerOptions): void {
    ConfigServer.pendingOptions = options;
  }

  static getPendingOptions(): ConfigServerOptions | undefined {
    return ConfigServer.pendingOptions;
  }

  constructor(options?: ConfigServerOptions) {
    const resolved = options ?? ConfigServer.pendingOptions;
    if (!resolved) {
      throw new Error(
        'ConfigServer requires options (constructor or ConfigServer.configure / forRoot)'
      );
    }
    if (!resolved.git && !resolved.nativePath) {
      throw new Error('ConfigServer requires git.uri or nativePath');
    }
    this.options = resolved;
    this.source = resolved.git
      ? new GitConfigSource({
          ...resolved.git,
          searchPaths: resolved.git.searchPaths ?? resolved.searchPaths,
          defaultLabel: resolved.git.defaultLabel ?? DEFAULT_LABEL,
        })
      : new FilesystemConfigSource(resolved.nativePath as string, DEFAULT_LABEL);
    this.encryptor = new ConfigEncryptor(resolved.encryption);
    this.audit = new AuditLog({ onAudit: resolved.onAudit });
    ConfigServer.instance = this;
  }

  async start(): Promise<this> {
    await this.sync();
    if (this.options.port != null) {
      await this.listen(this.options.port, this.options.host);
    }
    const interval = this.options.refreshInterval ?? 0;
    if (interval > 0) {
      this.refreshTimer = setInterval(() => {
        void this.refresh().catch(() => undefined);
      }, interval);
      this.refreshTimer.unref();
    }
    this.started = true;
    return this;
  }

  async close(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    await new Promise<void>((resolve, reject) => {
      if (!this.httpServer) {
        resolve();
        return;
      }
      this.httpServer.close((err) => (err ? reject(err) : resolve()));
    });
    this.httpServer = undefined;
    await this.source.close?.();
    this.started = false;
    if (ConfigServer.instance === this) {
      ConfigServer.resetInstance();
    }
  }

  async refresh(): Promise<ConfigEnvironment['version']> {
    const result = await this.sync();
    this.audit.record({ action: 'refresh', label: result.label, version: result.version });
    return result.version;
  }

  async getEnvironment(
    application: string,
    profiles?: string | string[],
    label?: string
  ): Promise<ConfigEnvironment> {
    const profileList = normalizeProfiles(profiles, this.options.profiles);
    const wantedLabel = label || this.options.git?.defaultLabel || DEFAULT_LABEL;
    if (!this.workingDir || (label && label !== this.syncedLabel)) {
      await this.sync(wantedLabel);
    }
    const searchPaths = this.options.git?.searchPaths ?? this.options.searchPaths;
    const propertySources = resolvePropertySources({
      root: this.workingDir as string,
      application,
      profiles: profileList,
      searchPaths,
    });
    let merged: Record<string, unknown> = {};
    for (const source of propertySources) {
      merged = deepMerge(merged, source.source);
    }
    merged = this.encryptor.decryptTree(merged);
    const env: ConfigEnvironment = {
      name: application,
      profiles: profileList,
      label: this.syncedLabel ?? wantedLabel,
      version: this.version,
      propertySources: propertySources.map((ps) => ({
        name: ps.name,
        source: this.encryptor.decryptTree(ps.source),
      })),
      config: merged,
    };
    this.audit.record({
      action: 'resolve',
      application,
      profiles: profileList,
      label: env.label,
      version: env.version,
    });
    return env;
  }

  encrypt(plaintext: string): string {
    const cipher = this.encryptor.encrypt(plaintext);
    this.audit.record({ action: 'encrypt' });
    return cipher;
  }

  decrypt(value: string): string {
    const plain = this.encryptor.decrypt(value);
    this.audit.record({ action: 'decrypt' });
    return plain;
  }

  getAuditLog(): ReturnType<AuditLog['list']> {
    return this.audit.list();
  }

  get address(): { port: number; host?: string } | undefined {
    const addr = this.httpServer?.address();
    if (addr && typeof addr === 'object') {
      return { port: addr.port, host: addr.address };
    }
    return undefined;
  }

  get isStarted(): boolean {
    return this.started;
  }

  private async sync(label?: string): Promise<{ dir: string; version?: string; label: string }> {
    const result = await this.source.sync(label);
    this.workingDir = result.dir;
    this.version = result.version;
    this.syncedLabel = result.label;
    this.audit.record({
      action: this.options.git ? 'pull' : 'sync',
      label: result.label,
      version: result.version,
      path: result.dir,
    });
    return result;
  }

  private listen(port: number, host?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        void this.handle(req, res);
      });
      this.httpServer.once('error', reject);
      this.httpServer.listen(port, host, () => {
        this.httpServer?.off('error', reject);
        resolve();
      });
    });
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const method = (req.method ?? 'GET').toUpperCase();
      const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';

      if (method === 'GET' && pathname === '/health') {
        sendJson(res, 200, { status: 'UP', version: this.version, label: this.syncedLabel });
        return;
      }
      if (method === 'GET' && pathname === '/audit') {
        sendJson(res, 200, { events: this.audit.list() });
        return;
      }
      if (method === 'POST' && pathname === '/refresh') {
        const version = await this.refresh();
        sendJson(res, 200, { version: version ?? null, label: this.syncedLabel });
        return;
      }
      if (method === 'POST' && pathname === '/encrypt') {
        const body = await readBody(req);
        const cipher = this.encrypt(body);
        this.audit.record({ action: 'http.encrypt' });
        sendText(res, 200, cipher);
        return;
      }
      if (method === 'POST' && pathname === '/decrypt') {
        const body = await readBody(req);
        const plain = this.decrypt(body);
        this.audit.record({ action: 'http.decrypt' });
        sendText(res, 200, plain);
        return;
      }
      if (method === 'GET' && pathname !== '/') {
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && parts.length <= 3) {
          const [application, profile, label] = parts;
          const env = await this.getEnvironment(application, profile, label);
          this.audit.record({
            action: 'http.fetch',
            application,
            profiles: env.profiles,
            label: env.label,
          });
          sendJson(res, 200, env);
          return;
        }
      }
      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message });
    }
  }
}
