/**
 * E2E: apply via control path; daemon process stays reachable after client disconnect.
 * Spawns hazeld-bin as a detached child (same as ensureDaemon).
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { controlRequest, isDaemonReachable, hazelHome, ensureHazelHome } from '../../src';

const HAZELD_BIN = path.resolve(__dirname, '../../dist/node/hazeld-bin.js');

describe('ensureDaemon E2E', () => {
  let tmp: string;
  let childPid: number | undefined;

  beforeAll(() => {
    if (!fs.existsSync(HAZELD_BIN)) {
      // Build must produce dist/node/hazeld-bin.js — skip if not built yet.
      console.warn(`Skipping E2E: missing ${HAZELD_BIN}`);
    }
  });

  beforeEach(() => {
    const root = path.join(__dirname, '..', '..', '.tmp-test');
    fs.mkdirSync(root, { recursive: true });
    tmp = fs.mkdtempSync(path.join(root, 'hazel-e2e-'));
    process.env.HAZEL_HOME = tmp;
    ensureHazelHome(hazelHome(tmp));
  });

  afterEach(async () => {
    const home = hazelHome(tmp);
    if (await isDaemonReachable(home.socketPath)) {
      try {
        await controlRequest({ op: 'shutdown' }, home.socketPath, 3000);
      } catch {
        // ignore
      }
    }
    if (childPid) {
      try {
        process.kill(childPid, 'SIGTERM');
      } catch {
        // ignore
      }
      childPid = undefined;
    }
    delete process.env.HAZEL_HOME;
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('daemon stays up after client exits; inspect Running', async () => {
    if (!fs.existsSync(HAZELD_BIN)) {
      return;
    }
    const home = hazelHome(tmp);
    const child = spawn(process.execPath, [HAZELD_BIN], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        HAZEL_HOME: tmp,
        HAZEL_PROJECT_ROOT: tmp,
      },
      cwd: tmp,
    });
    child.unref();
    childPid = child.pid;

    const start = Date.now();
    while (Date.now() - start < 10_000) {
      if (await isDaemonReachable(home.socketPath)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(await isDaemonReachable(home.socketPath)).toBe(true);

    // Client applies and disconnects (controlRequest ends the socket).
    const applied = await controlRequest(
      {
        op: 'apply',
        dna: {
          name: 'persist_agent',
          mission: 'stay alive',
          skills: [{ name: 'ping', description: 'ping' }],
        },
      },
      home.socketPath
    );
    expect(applied.ok).toBe(true);

    // Simulate CLI exit: wait, then re-connect — daemon still up.
    await new Promise((r) => setTimeout(r, 200));
    expect(await isDaemonReachable(home.socketPath)).toBe(true);

    const inspected = await controlRequest(
      { op: 'inspect', agentId: 'persist_agent' },
      home.socketPath
    );
    expect(inspected.ok).toBe(true);
    expect((inspected.data as { displayStatus: string }).displayStatus).toBe('Running');

    // PID file should still exist
    expect(fs.existsSync(home.pidPath)).toBe(true);
  }, 20_000);
});
