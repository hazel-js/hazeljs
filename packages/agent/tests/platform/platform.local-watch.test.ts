/// <reference types="jest" />

import {
  PLATFORM_API_VERSION,
  PlatformReconciler,
  InMemoryResourceRepository,
  LocalDeploymentBackend,
  parsePlatformResource,
  createLocalPlatform,
  watchLocalPlatform,
  exportAgentDna,
} from '../../src';

const DNA = exportAgentDna({
  name: 'support',
  tools: [{ name: 'lookup_order' }],
});

function definitionDoc() {
  return parsePlatformResource({
    apiVersion: PLATFORM_API_VERSION,
    kind: 'AgentDefinition',
    metadata: { name: 'support-agent' },
    spec: { dna: DNA },
  });
}

function deploymentDoc(name = 'support') {
  return parsePlatformResource({
    apiVersion: PLATFORM_API_VERSION,
    kind: 'AgentDeployment',
    metadata: { name },
    spec: {
      definitionRef: { name: 'support-agent' },
      runtimeClassName: 'local',
    },
  });
}

describe('platform local control plane — reconcileAll + watch', () => {
  it('reconcileAll converges all deployments', async () => {
    const repo = new InMemoryResourceRepository();
    const reconciler = new PlatformReconciler(repo, {
      backends: { local: new LocalDeploymentBackend() },
    });

    await reconciler.applyResource(definitionDoc());
    await reconciler.applyResource(deploymentDoc('a'));
    await reconciler.applyResource(deploymentDoc('b'));

    const result = await reconciler.reconcileAll();
    expect(result.errors).toEqual([]);
    expect(result.ready).toBe(2);
    expect(result.notReady).toBe(0);
    expect(result.results).toHaveLength(2);
  });

  it('watchLocalPlatform ticks then stops on abort', async () => {
    const platform = createLocalPlatform({ events: false });
    await platform.reconciler.applyResource(definitionDoc());
    await platform.reconciler.applyResource(deploymentDoc());

    const ticks: number[] = [];
    const ac = new AbortController();
    const watchPromise = watchLocalPlatform(platform, {
      intervalMs: 50,
      signal: ac.signal,
      onTick: async (_r, tick) => {
        ticks.push(tick);
        if (tick >= 2) ac.abort();
      },
    });

    await watchPromise;
    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });
});
