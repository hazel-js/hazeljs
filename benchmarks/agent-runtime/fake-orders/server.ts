/**
 * Bootstrap the fake order/refund API as a HazelJS core app
 * (`HazelApp` + `@Controller` / `@Service`) — not raw `node:http`.
 *
 * Still an *external* system relative to Agent OS: file-backed state so
 * hazeld SIGKILL leaves effects intact.
 */
import { HazelApp } from '@hazeljs/core';
import { FakeOrdersModule } from './app.module';
import { OrdersService, setOrdersDataPath } from './orders.service';

export interface FakeOrdersHandle {
  baseUrl: string;
  close: () => Promise<void>;
  stats: () => { refundCount: number; postAttempts: number; refunds: any[] };
  configure: (flags: Record<string, unknown>) => void;
  release: () => void;
}

export async function startFakeOrders(dataPath: string, port = 0): Promise<FakeOrdersHandle> {
  setOrdersDataPath(dataPath);

  const app = new HazelApp(FakeOrdersModule);
  // Hold-after-commit crash tests can block the response briefly.
  app.setRequestTimeout(120_000);
  await app.listen(port, '127.0.0.1');

  const addr = app.getServer()?.address();
  if (!addr || typeof addr === 'string') {
    await app.close();
    throw new Error('fake-orders bind failed');
  }

  const orders = app.getContainer().resolve(OrdersService) as OrdersService;

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () => app.close(),
    stats: () => {
      const s = orders.stats();
      return {
        refundCount: s.refundCount,
        postAttempts: s.postAttempts,
        refunds: s.refunds,
      };
    },
    configure: (flags) => orders.configure(flags),
    release: () => orders.release(),
  };
}
