/// <reference types="jest" />

jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  Injectable: () => () => undefined,
  Service: () => () => undefined,
  Inject: () => () => undefined,
  HazelModule: () => () => undefined,
  Container: { getInstance: jest.fn() },
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { Container } from '@hazeljs/core';
import { WorkerTaskDiscovery } from './worker.discovery';
import { WorkerRegistry } from './worker.registry';
import { WorkerTask } from './worker.decorator';

@WorkerTask({ name: 'discovered-task' })
class DiscoveredTask {
  run(_payload: unknown) {
    return 'ok';
  }
}

describe('WorkerTaskDiscovery', () => {
  let registry: WorkerRegistry;
  let discovery: WorkerTaskDiscovery;

  beforeEach(() => {
    registry = new WorkerRegistry();
    discovery = new WorkerTaskDiscovery(registry);
    jest.mocked(Container.getInstance).mockReturnValue({
      getTokens: jest.fn().mockReturnValue([DiscoveredTask]),
      resolve: jest.fn().mockReturnValue(new DiscoveredTask()),
    } as never);
  });

  it('registers from taskRegistry when provided', async () => {
    await discovery.onApplicationBootstrap({} as never, {
      taskRegistry: { 'manual-task': '/path/to/manual.js' },
      timeout: 8000,
    });

    expect(registry.has('manual-task')).toBe(true);
    expect(registry.get('manual-task').handlerPath).toContain('manual.js');
    expect(registry.get('manual-task').timeout).toBe(8000);
  });

  it('registers from taskDirectory when discovered names exist', async () => {
    await discovery.onApplicationBootstrap({} as never, {
      taskDirectory: '/tasks',
      timeout: 5000,
    });

    expect(registry.has('discovered-task')).toBe(true);
    expect(registry.get('discovered-task').handlerPath).toContain('discovered-task.js');
  });

  it('merges taskRegistry and taskDirectory when both provided', async () => {
    await discovery.onApplicationBootstrap({} as never, {
      taskRegistry: { manual: '/manual.js' },
      taskDirectory: '/tasks',
      timeout: 3000,
    });

    expect(registry.has('manual')).toBe(true);
    expect(registry.has('discovered-task')).toBe(true);
  });

  it('skips taskDirectory when no discovered names', async () => {
    jest.mocked(Container.getInstance).mockReturnValue({
      getTokens: jest.fn().mockReturnValue([]),
      resolve: jest.fn(),
    } as never);

    const emptyDiscovery = new WorkerTaskDiscovery(registry);
    await emptyDiscovery.onApplicationBootstrap({} as never, {
      taskDirectory: '/tasks',
      timeout: 5000,
    });

    expect(registry.getTaskNames()).toHaveLength(0);
  });

  it('discoverTaskNames returns names from container', async () => {
    await discovery.onApplicationBootstrap(
      {} as never,
      {
        taskDirectory: __dirname,
        timeout: 5000,
      } as never
    );

    expect(registry.getTaskNames()).toContain('discovered-task');
  });
});
