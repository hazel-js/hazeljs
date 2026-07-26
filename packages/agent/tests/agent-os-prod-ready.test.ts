import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { assessKnowledgeFreshness } from '../src/knowledge/knowledge-freshness';
import { FileTimelineStore, attachTimelineStore } from '../src/timeline/timeline.store';
import { AgentTimelineRecorder } from '../src/timeline/timeline.recorder';
import { AgentEventType } from '../src/types/event.types';
import { exportAgentDna, parseDna } from '../src/dna/agent-dna';
import { hotReloadAgentDna } from '../src/dna/hot-reload';
import { installAgentPackage, saveMarketplacePackage, loadMarketplacePackage } from '../src/dna/marketplace';
import { memoryGraphFromKnowledgeGraph } from '../src/memory-graph/graphrag-bridge';
import { AgentMemoryGraph } from '../src/memory-graph/memory-graph';
import { AgentRegistry } from '../src/registry/agent.registry';
import { PolicyEngine } from '../src/policies/policy.engine';

describe('Agent OS production hardening', () => {
  it('assesses knowledge freshness', () => {
    const now = Date.now();
    const report = assessKnowledgeFreshness(
      [
        { id: '1', updatedAt: now - 1000, confidence: 0.9 },
        { id: '2', expiresAt: now - 10 },
      ],
      { maxAgeMs: 60_000, now }
    );
    expect(report.stale).toBe(true);
    expect(report.recommendation).toBe('re_fetch');
    expect(report.freshCount).toBe(1);
  });

  it('persists timeline to file store', () => {
    const file = path.join(os.tmpdir(), `hazel-timeline-${Date.now()}.jsonl`);
    const store = new FileTimelineStore(file);
    const recorder = new AgentTimelineRecorder();
    const unsub = attachTimelineStore(recorder, store);
    recorder.record({
      type: AgentEventType.EXECUTION_STARTED,
      agentId: 'a',
      executionId: 'e1',
      timestamp: new Date(),
      data: { input: 'hi' },
    } as never);
    const loaded = store.load({ executionId: 'e1' });
    expect(loaded.length).toBe(1);
    unsub();
    fs.unlinkSync(file);
  });

  it('hot-reloads DNA onto registry', () => {
    const registry = new AgentRegistry();
    // manually seed metadata map via registerInstance path — use patch after fake insert
    (registry as unknown as { agents: Map<string, { name: string; systemPrompt?: string }> }).agents.set(
      'support',
      { name: 'support', systemPrompt: 'old' }
    );
    const dna = exportAgentDna({ name: 'support', systemPrompt: 'new prompt', tools: [{ name: 'lookup' }] });
    const engine = new PolicyEngine();
    const tools: string[] = [];
    const result = hotReloadAgentDna(
      {
        getAgent: (n) => registry.getAgent(n),
        patchAgent: (n, p) => registry.patchAgent(n, p),
        setPolicyEngine: () => undefined,
        getPolicyEngine: () => engine,
        registerDynamicTool: (_a, t) => tools.push(t.name),
      },
      dna
    );
    expect(result.updated).toContain('systemPrompt');
    expect(registry.getAgent('support')?.systemPrompt).toBe('new prompt');
    expect(tools).toContain('lookup');
  });

  it('marketplace package roundtrips', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-dna-'));
    const dna = exportAgentDna({ name: 'bot', systemPrompt: 'x' });
    const file = path.join(dir, 'bot.dna.json');
    fs.writeFileSync(file, JSON.stringify(dna));
    const pkg = loadMarketplacePackage(file);
    expect(pkg.dna.name).toBe('bot');
    const out = path.join(dir, 'pkg.json');
    saveMarketplacePackage(pkg, out);
    expect(fs.existsSync(out)).toBe(true);
    const parsed = parseDna(pkg.dna);
    expect(parsed.format).toBe('hazeljs.agent.dna');
  });

  it('bridges memory graph from knowledge graph like', () => {
    const kg = {
      entities: new Map([
        ['1', { id: '1', name: 'Ada', type: 'person', description: 'dev' }],
      ]),
      relationships: new Map(),
    };
    const g = memoryGraphFromKnowledgeGraph(kg);
    expect(g.search('Ada')).toHaveLength(1);
    const empty = new AgentMemoryGraph();
    expect(empty.toJSON().nodes).toHaveLength(0);
  });

  it('installAgentPackage uses hot reload', () => {
    const registry = new AgentRegistry();
    (registry as unknown as { agents: Map<string, { name: string }> }).agents.set('bot', {
      name: 'bot',
    });
    const dna = exportAgentDna({ name: 'bot', systemPrompt: 'installed' });
    const r = installAgentPackage(
      {
        getAgent: (n) => registry.getAgent(n),
        patchAgent: (n, p) => registry.patchAgent(n, p),
      },
      dna
    );
    expect(r.updated).toContain('systemPrompt');
  });
});
