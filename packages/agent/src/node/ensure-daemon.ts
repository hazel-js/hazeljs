/**
 * Ensure hazeld is running (spawn detached if needed).
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { hazelHome, ensureHazelHome } from './paths';
import { isDaemonReachable } from './control-api';

export interface EnsureDaemonOptions {
  home?: string;
  /** Path to hazeld entry script (node file). */
  hazeldScript?: string;
  /** Max wait for socket readiness. */
  timeoutMs?: number;
  projectRoot?: string;
}

export async function ensureDaemon(options: EnsureDaemonOptions = {}): Promise<{
  started: boolean;
  pid?: number;
  socketPath: string;
}> {
  const home = ensureHazelHome(hazelHome(options.home));
  if (await isDaemonReachable(home.socketPath)) {
    let pid: number | undefined;
    try {
      pid = Number(fs.readFileSync(home.pidPath, 'utf8').trim()) || undefined;
    } catch {
      // ignore
    }
    return { started: false, pid, socketPath: home.socketPath };
  }

  const script = options.hazeldScript ?? resolveHazeldScript();
  const child = spawn(process.execPath, [script], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      HAZEL_HOME: home.home,
      HAZEL_PROJECT_ROOT: options.projectRoot ?? process.cwd(),
    },
    cwd: options.projectRoot ?? process.cwd(),
  });
  child.unref();

  const timeoutMs = options.timeoutMs ?? 10_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isDaemonReachable(home.socketPath)) {
      return { started: true, pid: child.pid, socketPath: home.socketPath };
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for hazeld at ${home.socketPath}. Tried starting: ${script}`);
}

function resolveHazeldScript(): string {
  // Prefer packaged CLI bin next to hazel, then agent package dist.
  const candidates = [
    path.join(__dirname, '..', '..', '..', 'cli', 'dist', 'hazeld.js'),
    path.join(__dirname, 'hazeld-bin.js'),
    path.join(__dirname, '..', '..', 'dist', 'node', 'hazeld-bin.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Dev: ts-jest / ts-node path — run via agent package dist after build
  const dist = path.resolve(__dirname, 'hazeld-bin.js');
  return dist;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
