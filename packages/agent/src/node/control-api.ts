/**
 * Local control API — Unix domain socket (named pipe on Windows).
 */

import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import type { HazelNode } from './types';
import type { ControlRequest, ControlResponse } from './protocol';
import { hazelHome, ensureHazelHome } from './paths';
import type { SecretStore } from './secrets';

export interface ControlApiServerOptions {
  node: HazelNode;
  secrets?: SecretStore;
  socketPath?: string;
  onShutdown?: () => void | Promise<void>;
  /** Called after a successful apply (e.g. re-arm schedules). */
  onApply?: () => void | Promise<void>;
}

export class LocalControlApiServer {
  private server?: net.Server;
  private readonly socketPath: string;
  private readonly node: HazelNode;
  private readonly secrets?: SecretStore;
  private readonly onShutdown?: () => void | Promise<void>;
  private readonly onApply?: () => void | Promise<void>;

  constructor(options: ControlApiServerOptions) {
    const home = ensureHazelHome(hazelHome());
    this.socketPath = options.socketPath ?? home.socketPath;
    this.node = options.node;
    this.secrets = options.secrets;
    this.onShutdown = options.onShutdown;
    this.onApply = options.onApply;
  }

  get path(): string {
    return this.socketPath;
  }

  async listen(): Promise<void> {
    if (process.platform !== 'win32') {
      try {
        if (fs.existsSync(this.socketPath)) fs.unlinkSync(this.socketPath);
      } catch {
        // ignore
      }
      fs.mkdirSync(path.dirname(this.socketPath), { recursive: true });
    }

    this.server = net.createServer((socket) => {
      let buffer = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk) => {
        buffer += chunk;
        let idx: number;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          void this.handleLine(line)
            .then((res) => {
              socket.write(JSON.stringify(res) + '\n');
              if ((JSON.parse(line) as ControlRequest).op === 'shutdown') {
                socket.end();
              }
            })
            .catch((err) => {
              socket.write(
                JSON.stringify({
                  ok: false,
                  error: err instanceof Error ? err.message : String(err),
                }) + '\n'
              );
            });
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.socketPath, () => resolve());
    });
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => resolve());
    });
    if (process.platform !== 'win32') {
      try {
        if (fs.existsSync(this.socketPath)) fs.unlinkSync(this.socketPath);
      } catch {
        // ignore
      }
    }
  }

  private async handleLine(line: string): Promise<ControlResponse> {
    let req: ControlRequest;
    try {
      req = JSON.parse(line) as ControlRequest;
    } catch {
      return { ok: false, error: 'Invalid JSON request' };
    }
    try {
      const data = await this.dispatch(req);
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async dispatch(req: ControlRequest): Promise<unknown> {
    switch (req.op) {
      case 'ping':
        return { pong: true, pid: process.pid };
      case 'status':
        return this.node.status();
      case 'list':
        return this.node.list();
      case 'inspect':
        return this.node.inspect(req.agentId);
      case 'apply': {
        const applied = await this.node.apply(req.dna);
        await this.onApply?.();
        return applied;
      }
      case 'start':
      case 'run':
        return this.node.start(req.agentId, req.input);
      case 'stop':
        return this.node.stop(req.agentId);
      case 'restart':
        return this.node.restart(req.agentId);
      case 'remove':
        await this.node.remove(req.agentId);
        return { removed: req.agentId };
      case 'runs':
        return this.node.listRuns(req.agentId);
      case 'approvals':
        return this.node.listApprovals();
      case 'approve':
        return this.node.approve(req.taskId, req.by);
      case 'deny':
        return this.node.deny(req.taskId, req.by);
      case 'recover':
        return this.node.recover();
      case 'metrics':
        return (
          (this.node as { agentOs?: { metrics(): Promise<unknown> } }).agentOs?.metrics?.() ?? {}
        );
      case 'skills':
        return (this.node as { agentOs?: { listSkills(): unknown } }).agentOs?.listSkills?.() ?? [];
      case 'secret.set':
        if (!this.secrets) throw new Error('Secrets store not available');
        await this.secrets.set(req.name, req.value);
        return { set: req.name };
      case 'secret.delete':
        if (!this.secrets) throw new Error('Secrets store not available');
        await this.secrets.delete(req.name);
        return { deleted: req.name };
      case 'secret.has':
        if (!this.secrets) return { has: false };
        return { has: Boolean(await this.secrets.get(req.name)) };
      case 'shutdown':
        void Promise.resolve(this.onShutdown?.()).then(() => process.exit(0));
        return { shuttingDown: true };
      default:
        throw new Error(`Unknown op: ${(req as { op: string }).op}`);
    }
  }
}

export async function controlRequest(
  req: ControlRequest,
  socketPath?: string,
  timeoutMs = 15_000
): Promise<ControlResponse> {
  const home = hazelHome();
  const sock = socketPath ?? home.socketPath;
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(sock);
    let buffer = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`hazeld control timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    socket.setEncoding('utf8');
    socket.on('connect', () => {
      socket.write(JSON.stringify(req) + '\n');
    });
    socket.on('data', (chunk) => {
      buffer += chunk;
      const idx = buffer.indexOf('\n');
      if (idx >= 0) {
        clearTimeout(timer);
        const line = buffer.slice(0, idx);
        socket.end();
        try {
          resolve(JSON.parse(line) as ControlResponse);
        } catch (e) {
          reject(e);
        }
      }
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function isDaemonReachable(socketPath?: string): Promise<boolean> {
  try {
    const res = await controlRequest({ op: 'ping' }, socketPath, 2000);
    return res.ok === true;
  } catch {
    return false;
  }
}
