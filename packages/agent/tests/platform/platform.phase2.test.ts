import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  PLATFORM_API_VERSION,
  PlatformReconciler,
  InMemoryResourceRepository,
  LocalDeploymentBackend,
  parsePlatformResource,
  createLocalPlatform,
  createCompositePackageResolver,
  createFileDurableRunLookup,
  FileResourceRepository,
  exportAgentDna,
  LocalFsAgentRegistry,
  toMarketplacePackage,
  materializeAgentPackage,
  FileAgentRunRepository,
  AgentRunStatus,
  conditionOf,
} from '../../src';

const DNA = exportAgentDna({
  name: 'support',
  systemPrompt: 'Help customers',
  tools: [{ name: 'lookup_order' }],
});

describe('platform phase 2 — package resolution', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-p2-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('resolves packageRef from project .hazel/agents before registry', async () => {
    const registry = new LocalFsAgentRegistry({ rootDir: path.join(tmp, 'registry') });
    const pkg = toMarketplacePackage(DNA);
    registry.publish(pkg);
    materializeAgentPackage(pkg, tmp);

    const resolver = createCompositePackageResolver({
      projectRoot: tmp,
      registryRoot: registry.rootDir,
    });
    const resolved = await resolver({ name: pkg.name });
    expect(resolved.source).toBe('project');
    expect(resolved.dna.name).toBe('support');
    expect(resolved.version).toBe(pkg.version);
  });

  it('falls back to registry when not materialized', async () => {
    const registry = new LocalFsAgentRegistry({ rootDir: path.join(tmp, 'registry') });
    const pkg = toMarketplacePackage(DNA);
    registry.publish(pkg);

    const platform = createLocalPlatform({
      storePath: path.join(tmp, 'platform.json'),
      projectRoot: tmp,
      registryRoot: registry.rootDir,
    });
    const result = await platform.reconciler.applyResource(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentDefinition',
        metadata: { name: 'from-reg' },
        spec: { packageRef: { name: pkg.name } },
      })
    );
    expect(result.ready).toBe(true);
    expect(result.resource.status?.backend?.packageSource).toBe('registry');
    expect(result.resource.status?.backend?.dnaName).toBe('support');
  });

  it('errors with searched locations when missing', async () => {
    const resolver = createCompositePackageResolver({
      projectRoot: tmp,
      registryRoot: path.join(tmp, 'empty-registry'),
    });
    await expect(resolver({ name: '@hazeljs/missing-agent', version: '1.0.0' })).rejects.toThrow(
      /searched:/
    );
  });
});

describe('platform phase 2 — durable run correlation', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-p2-run-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('correlates AgentRun resource with durable file run store', async () => {
    const runsPath = path.join(tmp, 'runs.json');
    const runRepo = new FileAgentRunRepository(runsPath);
    const created = await runRepo.create({
      id: 'exec_test_1',
      agentName: 'support',
      input: { q: 'hi' },
    });

    const timelinePath = path.join(tmp, 'timeline.jsonl');
    fs.writeFileSync(
      timelinePath,
      `${JSON.stringify({
        id: 's1',
        executionId: created.id,
        agentId: 'support',
        type: 'step',
        timestamp: new Date().toISOString(),
        data: {},
      })}\n`
    );

    const repo = new InMemoryResourceRepository();
    const reconciler = new PlatformReconciler(repo, {
      backends: { local: new LocalDeploymentBackend() },
      durableRunLookup: createFileDurableRunLookup({ runsPath, timelinePath }),
    });

    await reconciler.applyResource(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentDefinition',
        metadata: { name: 'support-agent' },
        spec: { dna: DNA },
      })
    );

    const result = await reconciler.applyResource(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentRun',
        metadata: { name: 'run-1' },
        spec: {
          definitionRef: { name: 'support-agent' },
          runId: created.id,
        },
      })
    );

    expect(result.ready).toBe(true);
    expect(conditionOf(result.resource.status, 'Ready')?.reason).toBe('Correlated');
    expect(result.resource.status?.backend?.found).toBe(true);
    expect(result.resource.status?.backend?.status).toBe(AgentRunStatus.CREATED);
    expect(result.resource.status?.backend?.timelineSteps).toBe(1);
    expect(String(result.resource.status?.backend?.note)).toMatch(/Checkpoints remain/);
  });

  it('marks Degraded when runId is missing from durable store', async () => {
    const repo = new InMemoryResourceRepository();
    const reconciler = new PlatformReconciler(repo, {
      backends: { local: new LocalDeploymentBackend() },
      durableRunLookup: createFileDurableRunLookup({
        runsPath: path.join(tmp, 'missing-runs.json'),
      }),
    });
    await reconciler.applyResource(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentDefinition',
        metadata: { name: 'support-agent' },
        spec: { dna: DNA },
      })
    );
    const result = await reconciler.applyResource(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentRun',
        metadata: { name: 'run-missing' },
        spec: {
          definitionRef: { name: 'support-agent' },
          runId: 'does-not-exist',
        },
      })
    );
    expect(result.ready).toBe(false);
    expect(conditionOf(result.resource.status, 'Degraded')?.reason).toBe('DurableRunNotFound');
  });
});

describe('platform phase 2 — file repository', () => {
  it('persists across repository instances', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-p2-fs-'));
    try {
      const file = path.join(tmp, 'resources.json');
      const a = new FileResourceRepository(file);
      a.upsert(
        parsePlatformResource({
          apiVersion: PLATFORM_API_VERSION,
          kind: 'AgentDefinition',
          metadata: { name: 'persist-me' },
          spec: { dna: DNA },
        })
      );
      const b = new FileResourceRepository(file);
      expect(b.get('AgentDefinition', 'persist-me')?.metadata.name).toBe('persist-me');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
