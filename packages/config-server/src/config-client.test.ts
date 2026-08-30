import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigClient } from './config-client';
import { ConfigServer } from './config-server';
import { ConfigValue } from './config-value.decorator';
import {
  ConfigServerModule,
  EnableConfigServer,
  getConfigServerMetadata,
} from './config-server.module';

function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
}

describe('ConfigClient', () => {
  let root: string;
  let server: ConfigServer;
  let client: ConfigClient;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-cfg-client-'));
    ConfigServer.resetInstance();
    ConfigClient.resetInstance();
  });

  afterEach(async () => {
    client?.close();
    await server?.close();
    ConfigServer.resetInstance();
    ConfigClient.resetInstance();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('requires uri or server and application', () => {
    expect(() => new ConfigClient()).toThrow(/requires options/);
    expect(() => new ConfigClient({ application: 'x' } as any)).toThrow(/uri or an in-process/);
    expect(() => new ConfigClient({ uri: 'http://localhost', application: '' })).toThrow(
      /application is required/
    );
  });

  it('loads from an in-process server and supports get/getOrThrow/refresh', async () => {
    writeTree(root, {
      'application.yml': 'database:\n  url: postgres://local\n  port: 5432\n',
      'user-service-prod.yml': 'database:\n  url: postgres://prod\n',
    });
    server = new ConfigServer({ nativePath: root });
    await server.start();
    client = new ConfigClient({
      server,
      application: 'user-service',
      profiles: 'prod',
    });
    await client.load();
    expect(client.get('database.url')).toBe('postgres://prod');
    expect(client.get('database.port')).toBe(5432);
    expect(client.get('missing', 'fallback')).toBe('fallback');
    expect(client.getOrThrow('database.port')).toBe(5432);
    expect(() => client.getOrThrow('nope')).toThrow(/required but not found/);
    expect(client.getAll().database).toEqual({ url: 'postgres://prod', port: 5432 });
    expect(client.getEnvironment()?.name).toBe('user-service');
    expect(ConfigClient.getInstance()).toBe(client);

    fs.writeFileSync(path.join(root, 'user-service-prod.yml'), 'database:\n  url: postgres://v2\n');
    const changes: string[] = [];
    const off = client.onChange((env) =>
      changes.push((env.config.database as { url: string }).url)
    );
    await client.refresh();
    expect(client.get('database.url')).toBe('postgres://v2');
    expect(changes).toEqual(['postgres://v2']);
    off();
  });

  it('fetches over HTTP', async () => {
    writeTree(root, { 'application.yml': 'ok: true\n' });
    server = new ConfigServer({ nativePath: root, port: 0 });
    await server.start();
    const port = server.address?.port as number;
    client = new ConfigClient({
      uri: `http://127.0.0.1:${port}`,
      application: 'any',
      profiles: ['default'],
    });
    await client.load();
    expect(client.get('ok')).toBe(true);
  });

  it('rejects unreachable HTTP servers', async () => {
    client = new ConfigClient({
      uri: 'http://127.0.0.1:59999',
      application: 'app',
    });
    await expect(client.load()).rejects.toThrow();
  });

  it('failFast throws before load', () => {
    writeTree(root, { 'application.yml': 'a: 1\n' });
    server = new ConfigServer({ nativePath: root });
    client = new ConfigClient({
      server,
      application: 'app',
      failFast: true,
    });
    expect(() => client.get('a')).toThrow(/has not loaded/);
  });

  it('getInstance throws before construct', () => {
    expect(() => ConfigClient.getInstance()).toThrow(/has not been loaded/);
  });
});

describe('ConfigValue + module', () => {
  let root: string;
  let server: ConfigServer;
  let client: ConfigClient;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-cfg-dec-'));
    ConfigServer.resetInstance();
    ConfigClient.resetInstance();
  });

  afterEach(async () => {
    client?.close();
    await server?.close();
    ConfigServer.resetInstance();
    ConfigClient.resetInstance();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('injects live values when refresh is true', async () => {
    writeTree(root, {
      'application.yml': 'database:\n  url: first\napi:\n  timeout: 5\nflag: true\n',
    });
    server = new ConfigServer({ nativePath: root });
    await server.start();
    client = new ConfigClient({ server, application: 'app' });
    await client.load();

    class Settings {
      @ConfigValue('database.url', { refresh: true })
      dbUrl!: string;

      @ConfigValue('api.timeout', { type: 'number' })
      timeout!: number;

      @ConfigValue('flag', { type: 'boolean' })
      flag!: boolean;

      @ConfigValue('missing', { default: 'x' })
      missing!: string;
    }

    const settings = new Settings();
    expect(settings.dbUrl).toBe('first');
    expect(settings.timeout).toBe(5);
    expect(settings.flag).toBe(true);
    expect(settings.missing).toBe('x');

    fs.writeFileSync(
      path.join(root, 'application.yml'),
      'database:\n  url: second\napi:\n  timeout: 5\nflag: true\n'
    );
    await client.refresh();
    expect(settings.dbUrl).toBe('second');
  });

  it('EnableConfigServer and forRoot store options', () => {
    @EnableConfigServer({ nativePath: '/tmp/cfg' })
    class App {}
    expect(getConfigServerMetadata(App)).toEqual({ nativePath: '/tmp/cfg' });
    expect(ConfigServer.getPendingOptions()?.nativePath).toBe('/tmp/cfg');

    expect(ConfigServerModule.forRoot({ nativePath: '/tmp/b' })).toBe(ConfigServerModule);
    expect(ConfigServer.getPendingOptions()?.nativePath).toBe('/tmp/b');
    expect(ConfigServerModule.forClient({ uri: 'http://x', application: 'a' })).toBe(
      ConfigServerModule
    );
  });
});
