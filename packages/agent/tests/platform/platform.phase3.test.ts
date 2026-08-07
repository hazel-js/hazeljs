import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  PLATFORM_API_VERSION,
  PlatformReconciler,
  InMemoryResourceRepository,
  LocalDeploymentBackend,
  parsePlatformResource,
  PolicyAdmissionController,
  InMemoryPlatformEventSink,
  summarizeResource,
  isReady,
  exportAgentDna,
  PlatformValidationError,
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

function deploymentDoc() {
  return parsePlatformResource({
    apiVersion: PLATFORM_API_VERSION,
    kind: 'AgentDeployment',
    metadata: { name: 'support' },
    spec: {
      definitionRef: { name: 'support-agent' },
      runtimeClassName: 'local',
    },
  });
}

describe('platform phase 3 — admission + events + observability', () => {
  it('emits admission and reconcile events', async () => {
    const events = new InMemoryPlatformEventSink();
    const repo = new InMemoryResourceRepository();
    const reconciler = new PlatformReconciler(repo, {
      backends: { local: new LocalDeploymentBackend() },
      admission: new PolicyAdmissionController(),
      events,
      actor: 'test',
    });

    await reconciler.applyResource(definitionDoc());
    await reconciler.applyResource(deploymentDoc());

    const types = events.list().map((e) => e.type);
    expect(types).toContain('AdmissionAllowed');
    expect(types).toContain('ResourceApplied');
    expect(types).toContain('ResourceReconciled');
  });

  it('denies apply when PolicyEngine denies platform.apply', async () => {
    const events = new InMemoryPlatformEventSink();
    const repo = new InMemoryResourceRepository();
    const reconciler = new PlatformReconciler(repo, {
      backends: { local: new LocalDeploymentBackend() },
      admission: new PolicyAdmissionController({
        rules: [
          {
            id: 'deny-all-apply',
            tool: 'platform.apply',
            effect: 'deny',
            reason: 'frozen environment',
          },
        ],
      }),
      events,
      actor: 'test',
    });

    await expect(reconciler.applyResource(definitionDoc())).rejects.toThrow(
      PlatformValidationError
    );
    expect(events.list({ type: 'AdmissionDenied' }).length).toBe(1);
    expect(repo.list()).toHaveLength(0);
  });

  it('persists events to JSONL', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-p3-'));
    try {
      const { createLocalPlatform } = await import('../../src');
      const storePath = path.join(tmp, 'resources.json');
      const eventsPath = path.join(tmp, 'events.jsonl');
      const platform = createLocalPlatform({
        storePath,
        eventsPath,
        actor: 'test',
      });
      await platform.reconciler.applyResource(definitionDoc());
      expect(fs.existsSync(eventsPath)).toBe(true);
      const lines = fs.readFileSync(eventsPath, 'utf8').trim().split('\n');
      expect(lines.length).toBeGreaterThan(0);
      const reloaded = createLocalPlatform({ storePath, eventsPath });
      expect(reloaded.events.list().length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('summarizeResource is secret-safe and ready-aware', async () => {
    const repo = new InMemoryResourceRepository();
    const reconciler = new PlatformReconciler(repo, {
      backends: { local: new LocalDeploymentBackend() },
    });
    const result = await reconciler.applyResource(definitionDoc());
    const summary = summarizeResource(result.resource);
    expect(summary.ready).toBe('True');
    expect(summary.correlation?.dnaName).toBe('support');
    expect(isReady(result.resource)).toBe(true);
    expect(JSON.stringify(summary)).not.toMatch(/systemPrompt|Help customers/);
  });
});
