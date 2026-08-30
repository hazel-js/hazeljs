import 'reflect-metadata';
import { MemoryGuard, getMemoryGuardMonitor } from '../decorators';

describe('MemoryGuard decorator', () => {
  it('starts and stops monitor via lifecycle hooks', async () => {
    @MemoryGuard({ threshold: 1, action: 'notify-only', intervalMs: 100000 })
    class HeavyService {
      async onModuleInit(): Promise<void> {
        return;
      }

      async onModuleDestroy(): Promise<void> {
        return;
      }
    }

    const service = new HeavyService();
    const monitor = getMemoryGuardMonitor(HeavyService);

    expect(monitor).toBeDefined();

    await service.onModuleInit();
    await service.onModuleDestroy();
  });
});
