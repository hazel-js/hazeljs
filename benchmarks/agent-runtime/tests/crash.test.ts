/**
 * Crash conformance: real OS process SIGKILL of hazeld (app/main.ts).
 * Fake orders + durable dir stay alive. Control plane = controlRequest only.
 */
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { controlRequest, isDaemonReachable, AgentState, AgentRunStatus } from '@hazeljs/agent';
import { createFixture, wait } from './helpers';
import { recordScenario } from './report';

const MAIN = path.resolve(__dirname, '../app/main.ts');
const TSX = path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs');

function spawnHazeld(env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(process.execPath, [TSX, MAIN], {
    env: { ...process.env, ...env },
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  });
  if (!child.pid) throw new Error('spawn failed');
  child.unref();
  return child;
}

function killProcess(child: ChildProcess) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      process.kill(child.pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
}

async function waitSocket(socketPath: string, ms = 20_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await isDaemonReachable(socketPath)) return;
    await wait(50);
  }
  throw new Error(`hazeld not reachable: ${socketPath}`);
}

function hazeldEnv(fx: Awaited<ReturnType<typeof createFixture>>, workerId: string) {
  return {
    HAZEL_HOME: fx.home,
    DURABLE_DIR: fx.durableDir,
    SOCKET_PATH: fx.socketPath,
    FAKE_BASE_URL: fx.fake.baseUrl,
    AUTH_HEADER: fx.authHeader,
    ORDER_ID: fx.orderId,
    AMOUNT_MINOR: String(fx.amountMinor),
    OPERATION_KEY: fx.operationKey,
    WORKER_ID: workerId,
  };
}

describe('crash conformance (SIGKILL hazeld)', () => {
  it('crash while awaiting approval → recover → approve → one refund', async () => {
    if (process.platform === 'win32') {
      recordScenario({
        id: 'B-crash-awaiting-approval',
        title: 'crash while awaiting approval → recover → approve → one refund',
        status: 'skipped',
        steps: ['Skipped on win32 (no process-group SIGKILL semantics)'],
        observations: { platform: process.platform },
      });
      return;
    }

    const fx = await createFixture('hz-crash');
    const env = hazeldEnv(fx, `crash-a-${process.pid}`);
    const a = spawnHazeld(env);
    const steps: string[] = [];

    try {
      await waitSocket(fx.socketPath);
      steps.push(`Spawned hazeld pid=${a.pid}; control socket ready`);

      const start = await controlRequest(
        { op: 'start', agentId: 'refund-conformance', input: 'refund please' },
        fx.socketPath,
        30_000
      );
      expect(start.ok).toBe(true);
      const run = start.data as { id: string; status: string };
      expect(
        run.status === AgentRunStatus.SUSPENDED || run.status === AgentRunStatus.WAITING_FOR_HUMAN
      ).toBe(true);
      expect(fx.fake.stats().refundCount).toBe(0);
      steps.push(`start → run ${run.id} status=${run.status}; refundCount=0 (HITL gate)`);

      killProcess(a);
      await wait(5_500);
      steps.push('SIGKILL worker A; waited lease TTL (~5.5s); durable dir + fake orders intact');

      const homeB = path.join(fx.root, 'home-b');
      const socketB = path.join(fx.root, 'hazeld-b.sock');
      fs.mkdirSync(homeB, { recursive: true });
      const b = spawnHazeld({
        ...env,
        HAZEL_HOME: homeB,
        SOCKET_PATH: socketB,
        WORKER_ID: `crash-b-${process.pid}`,
      });

      try {
        await waitSocket(socketB);
        const recovered = await controlRequest({ op: 'recover' }, socketB, 15_000);
        expect(recovered.ok).toBe(true);
        steps.push(`Spawned worker B; recover ok=${recovered.ok}`);

        const approvals = await controlRequest({ op: 'approvals' }, socketB, 15_000);
        const taskId = ((approvals.data as any[])?.[0]?.id as string | undefined) ?? run.id;
        const done = await controlRequest(
          { op: 'approve', taskId, by: 'ops@test' },
          socketB,
          60_000
        );
        expect(done.ok).toBe(true);
        expect((done.data as { state: string }).state).toBe(AgentState.COMPLETED);
        expect(fx.fake.stats().refundCount).toBe(1);
        steps.push(
          `approve taskId=${taskId} → ${(done.data as { state: string }).state}; refundCount=1`
        );

        recordScenario({
          id: 'B-crash-awaiting-approval',
          title: 'crash while awaiting approval → recover → approve → one refund',
          status: 'pass',
          steps,
          observations: {
            mode: 'process SIGKILL + controlRequest',
            runId: run.id,
            preCrashStatus: run.status,
            preCrashRefundCount: 0,
            postRecoverRefundCount: fx.fake.stats().refundCount,
            finalState: (done.data as { state: string }).state,
          },
          claim:
            'Worker death while WAITING_FOR_APPROVAL; second worker recover+approve yields exactly one refund.',
        });
      } finally {
        killProcess(b);
      }
    } catch (err) {
      recordScenario({
        id: 'B-crash-awaiting-approval',
        title: 'crash while awaiting approval → recover → approve → one refund',
        status: 'fail',
        steps,
        observations: { refundCount: fx.fake.stats().refundCount },
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      killProcess(a);
      await fx.cleanup();
    }
  }, 90_000);

  it('crash after external commit → restart → reconcile → one refund', async () => {
    if (process.platform === 'win32') {
      recordScenario({
        id: 'C-crash-after-external-commit',
        title: 'crash after external commit → restart → reconcile → one refund',
        status: 'skipped',
        steps: ['Skipped on win32'],
        observations: { platform: process.platform },
      });
      return;
    }

    const fx = await createFixture('hz-xcom');
    fx.fake.configure({ holdAfterCommit: true });
    const env = hazeldEnv(fx, `xcom-a-${process.pid}`);
    const a = spawnHazeld(env);
    const steps: string[] = [];

    try {
      await waitSocket(fx.socketPath);
      const start = await controlRequest(
        { op: 'start', agentId: 'refund-conformance', input: 'refund please' },
        fx.socketPath,
        30_000
      );
      const run = start.data as { id: string };
      const approvals = await controlRequest({ op: 'approvals' }, fx.socketPath);
      const taskId = ((approvals.data as any[])?.[0]?.id as string) ?? run.id;
      steps.push(`HITL ready run=${run.id}; fake holdAfterCommit enabled`);

      const approveP = controlRequest(
        { op: 'approve', taskId, by: 'ops@test' },
        fx.socketPath,
        8_000
      ).catch(() => undefined);

      const t0 = Date.now();
      while (Date.now() - t0 < 15_000 && fx.fake.stats().refundCount < 1) {
        await wait(50);
      }
      expect(fx.fake.stats().refundCount).toBe(1);
      steps.push('Approve in flight; external refund committed (count=1) while response held');

      killProcess(a);
      fx.fake.release();
      void approveP;
      await wait(5_500);
      steps.push('SIGKILL during post-commit hold; released hold; waited lease TTL');

      const homeB = path.join(fx.root, 'home-b');
      const socketB = path.join(fx.root, 'hazeld-b.sock');
      fs.mkdirSync(homeB, { recursive: true });
      const b = spawnHazeld({
        ...env,
        HAZEL_HOME: homeB,
        SOCKET_PATH: socketB,
        WORKER_ID: `xcom-b-${process.pid}`,
      });

      try {
        await waitSocket(socketB);
        await controlRequest({ op: 'recover' }, socketB);
        const done = await controlRequest(
          { op: 'approve', taskId: run.id, by: 'ops@test' },
          socketB,
          60_000
        );
        expect(done.ok).toBe(true);
        expect(fx.fake.stats().refundCount).toBe(1);
        steps.push(`recover + resume on worker B → ok; refundCount still 1 (idempotent reconcile)`);

        recordScenario({
          id: 'C-crash-after-external-commit',
          title: 'crash after external commit → restart → reconcile → one refund',
          status: 'pass',
          steps,
          observations: {
            mode: 'process SIGKILL after external commit',
            runId: run.id,
            refundCountAfterCommitBeforeCrash: 1,
            refundCountAfterRecover: fx.fake.stats().refundCount,
            fakeIdempotency: true,
          },
          claim:
            'Crash after external refund commit; restart + reconcile does not create a second refund under fake idempotency.',
        });
      } finally {
        killProcess(b);
      }
    } catch (err) {
      recordScenario({
        id: 'C-crash-after-external-commit',
        title: 'crash after external commit → restart → reconcile → one refund',
        status: 'fail',
        steps,
        observations: { refundCount: fx.fake.stats().refundCount },
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      killProcess(a);
      await fx.cleanup();
    }
  }, 90_000);
});
