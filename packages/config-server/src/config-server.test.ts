import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { ConfigServer } from './config-server';
import { ConfigEncryptor } from './encryption';

function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
}

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') })
        );
      })
      .on('error', reject);
  });
}

function httpPost(url: string, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') })
        );
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

describe('ConfigServer', () => {
  let root: string;
  let server: ConfigServer;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-cfg-native-'));
    ConfigServer.resetInstance();
  });

  afterEach(async () => {
    await server?.close();
    ConfigServer.resetInstance();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('throws without git or nativePath', () => {
    expect(() => new ConfigServer({} as any)).toThrow(/git.uri or nativePath/);
    expect(() => new ConfigServer()).toThrow(/requires options/);
  });

  it('merges profiles and decrypts secrets', async () => {
    const enc = new ConfigEncryptor({ enabled: true, key: 'unit-key' });
    const cipher = enc.encrypt('s3cret');
    writeTree(root, {
      'application.yml': 'server:\n  port: 8080\n',
      'application-prod.yml': `server:\n  port: 443\ndatabase:\n  password: "${cipher}"\n`,
      'payments.yml': 'name: payments\n',
    });
    server = new ConfigServer({
      nativePath: root,
      encryption: { enabled: true, key: 'unit-key' },
    });
    await server.start();
    const env = await server.getEnvironment('payments', 'prod');
    expect(env.config.server).toEqual({ port: 443 });
    expect((env.config.database as { password: string }).password).toBe('s3cret');
    expect(env.propertySources.length).toBeGreaterThan(0);
    expect(server.getAuditLog().some((e) => e.action === 'resolve')).toBe(true);
    expect(ConfigServer.getInstance()).toBe(server);
  });

  it('encrypt/decrypt helpers audit the action', async () => {
    writeTree(root, { 'application.yml': 'a: 1\n' });
    server = new ConfigServer({
      nativePath: root,
      encryption: { enabled: true, key: 'k' },
    });
    await server.start();
    const cipher = server.encrypt('hello');
    expect(server.decrypt(cipher)).toBe('hello');
    expect(server.getAuditLog().some((e) => e.action === 'encrypt')).toBe(true);
  });

  it('serves HTTP endpoints', async () => {
    writeTree(root, {
      'application.yml': 'shared: true\n',
      'user-service-prod.yml': 'name: users\n',
    });
    server = new ConfigServer({ nativePath: root, port: 0 });
    await server.start();
    const port = server.address?.port as number;
    const base = `http://127.0.0.1:${port}`;

    const health = JSON.parse((await httpGet(`${base}/health`)).body);
    expect(health.status).toBe('UP');

    const envRes = await httpGet(`${base}/user-service/prod`);
    expect(envRes.status).toBe(200);
    const env = JSON.parse(envRes.body);
    expect(env.config.shared).toBe(true);
    expect(env.config.name).toBe('users');

    const labeled = await httpGet(`${base}/user-service/prod/main`);
    expect(labeled.status).toBe(200);

    const refresh = JSON.parse((await httpPost(`${base}/refresh`, '')).body);
    expect(refresh.label).toBe('main');

    const cipher = (await httpPost(`${base}/encrypt`, 'hidden')).body;
    expect(cipher.startsWith('{cipher}')).toBe(true);
    const plain = (await httpPost(`${base}/decrypt`, cipher)).body;
    expect(plain).toBe('hidden');

    const audit = JSON.parse((await httpGet(`${base}/audit`)).body);
    expect(Array.isArray(audit.events)).toBe(true);

    const missing = await httpGet(`${base}/nope`);
    expect(missing.status).toBe(404);
  });

  it('getInstance throws before start', () => {
    expect(() => ConfigServer.getInstance()).toThrow(/has not been started/);
  });
});
