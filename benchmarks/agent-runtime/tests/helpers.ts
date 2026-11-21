import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startFakeOrders, type FakeOrdersHandle } from '../fake-orders/server';

export interface Fixture {
  root: string;
  durableDir: string;
  home: string;
  socketPath: string;
  fake: FakeOrdersHandle;
  tenantId: string;
  orderId: string;
  authHeader: string;
  operationKey: string;
  amountMinor: number;
  cleanup: () => Promise<void>;
}

export async function createFixture(prefix = 'hz-cf'): Promise<Fixture> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const durableDir = path.join(root, 'durable');
  const home = path.join(root, 'home');
  // Prefer fixture-local socket (recover-hitl style). Fall back to short /tmp
  // path when the fixture path would exceed macOS unix-socket sun_path (~104).
  const localSock = path.join(root, 'hazeld.sock');
  const socketPath =
    localSock.length <= 100 ? localSock : path.join('/tmp', `hz-${path.basename(root)}.sock`);
  fs.mkdirSync(durableDir, { recursive: true });
  fs.mkdirSync(home, { recursive: true });

  const fake = await startFakeOrders(path.join(root, 'orders.json'));
  const tenantId = `tenant_${path.basename(root).slice(-8)}`;
  const orderId = `ord_${path.basename(root).slice(-6)}`;
  const authHeader = `Bearer tenant:${tenantId}`;
  const amountMinor = 2599;
  const operationKey = `op_${path.basename(root)}_refund`;

  await fetch(`${fake.baseUrl}/_test/seed`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, currency: 'USD', amountMinor: 10_000 }),
  });

  return {
    root,
    durableDir,
    home,
    socketPath,
    fake,
    tenantId,
    orderId,
    authHeader,
    operationKey,
    amountMinor,
    cleanup: async () => {
      await fake.close().catch(() => undefined);
      try {
        if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
      } catch {
        // ignore
      }
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

export async function wait(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}
