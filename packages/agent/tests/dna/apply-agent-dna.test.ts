import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  Agent,
  AgentRuntime,
  Tool,
  applyAgentDna,
  defaultPiiMaskPolicies,
  exportAgentDna,
  loadAndApplyAgentDna,
  loadDnaFile,
  policyRulesFromDna,
  PolicyEngine,
  resolveAgentDnaPath,
} from '../../src';

describe('apply-agent-dna', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-dna-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('resolveAgentDnaPath uses convention for dna: true', () => {
    expect(resolveAgentDnaPath({ name: 'campus_assistant', dna: true, projectRoot: tmp })).toBe(
      path.join(tmp, 'dna', 'campus_assistant.dna.json')
    );
  });

  it('resolveAgentDnaPath joins relative paths to projectRoot', () => {
    expect(
      resolveAgentDnaPath({
        name: 'x',
        dna: 'custom/agent.dna.json',
        projectRoot: tmp,
      })
    ).toBe(path.join(tmp, 'custom', 'agent.dna.json'));
  });

  it('loadDnaFile + policyRulesFromDna extracts PolicyRule entries', () => {
    const dna = exportAgentDna({
      name: 'bot',
      systemPrompt: 'hello',
      model: 'gpt-4o-mini',
      tools: [{ name: 'commit', requiresApproval: true }],
      policies: [
        {
          id: 'commit-hitl',
          tool: 'commit',
          effect: 'require_approval',
          priority: 50,
        },
      ],
    });
    const file = path.join(tmp, 'bot.dna.json');
    fs.writeFileSync(file, JSON.stringify(dna));
    const loaded = loadDnaFile(file);
    expect(loaded.name).toBe('bot');
    expect(policyRulesFromDna(loaded)).toEqual([
      expect.objectContaining({ id: 'commit-hitl', effect: 'require_approval' }),
    ]);
  });

  it('applyAgentDna merges policies without wiping existing PII rules', () => {
    @Agent({ name: 'bot', systemPrompt: 'fallback' })
    class Bot {}

    const runtime = new AgentRuntime({
      policyEngine: new PolicyEngine(defaultPiiMaskPolicies()),
      enableRetry: false,
      enableCircuitBreaker: false,
      enableMetrics: false,
    });
    runtime.registerAgent(Bot);
    runtime.registerAgentInstance('bot', new Bot());

    const dna = exportAgentDna({
      name: 'bot',
      systemPrompt: 'from-dna',
      description: 'DNA bot',
      model: 'gpt-4o-mini',
      policies: [{ id: 'hitl', tool: 'commit', effect: 'require_approval', priority: 20 }],
    });

    applyAgentDna(
      {
        getAgent: (n) => runtime.getAgentMetadata(n),
        patchAgent: (n, p) => {
          const meta = runtime.getAgentMetadata(n)!;
          Object.assign(meta, p);
        },
        getPolicyEngine: () => runtime.getPolicyEngine(),
        setPolicyEngine: (e) => runtime.setPolicyEngine(e),
      },
      dna
    );

    const meta = runtime.getAgentMetadata('bot')!;
    expect(meta.systemPrompt).toBe('from-dna');
    expect(meta.model).toBe('gpt-4o-mini');

    const rules = runtime.getPolicyEngine()!.getRules();
    expect(rules.some((r) => r.id === 'hitl')).toBe(true);
    expect(rules.some((r) => r.effect === 'mask')).toBe(true);
  });

  it('registerAgentInstance auto-loads @Agent({ dna: true }) without replacing tool handlers', async () => {
    const dnaDir = path.join(tmp, 'dna');
    fs.mkdirSync(dnaDir);
    const dna = exportAgentDna({
      name: 'desk',
      systemPrompt: 'dna-prompt',
      model: 'gpt-4o-mini',
      tools: [{ name: 'ping', description: 'ping', requiresApproval: false }],
      policies: [{ id: 'ping-ok', tool: 'ping', effect: 'allow', priority: 1 }],
    });
    fs.writeFileSync(path.join(dnaDir, 'desk.dna.json'), JSON.stringify(dna));

    @Agent({ name: 'desk', dna: true, systemPrompt: 'fallback' })
    class Desk {
      @Tool({ name: 'ping', description: 'real ping' })
      async ping(): Promise<{ ok: boolean }> {
        return { ok: true };
      }
    }

    const runtime = new AgentRuntime({
      projectRoot: tmp,
      policyEngine: new PolicyEngine(defaultPiiMaskPolicies()),
      enableRetry: false,
      enableCircuitBreaker: false,
      enableMetrics: false,
    });
    runtime.registerAgent(Desk);
    const instance = new Desk();
    runtime.registerAgentInstance('desk', instance);

    expect(runtime.getAgentMetadata('desk')?.systemPrompt).toBe('dna-prompt');
    expect(runtime.getAgentDna('desk')?.version).toBe(dna.version);

    const tools = runtime.getAgentTools('desk');
    const ping = tools.find((t) => t.name === 'ping');
    expect(ping).toBeDefined();
    expect(await ping!.method.call(instance, {})).toEqual({ ok: true });
  });

  it('loadAndApplyAgentDna rejects DNA name mismatch', () => {
    const file = path.join(tmp, 'wrong.dna.json');
    fs.writeFileSync(file, JSON.stringify(exportAgentDna({ name: 'other', systemPrompt: 'x' })));
    @Agent({ name: 'bot' })
    class Bot {}
    const runtime = new AgentRuntime({ enableRetry: false, enableCircuitBreaker: false });
    runtime.registerAgent(Bot);
    runtime.registerAgentInstance('bot', new Bot());

    expect(() =>
      loadAndApplyAgentDna(
        {
          getAgent: (n) => runtime.getAgentMetadata(n),
          patchAgent: (n, p) => Object.assign(runtime.getAgentMetadata(n)!, p),
        },
        { name: 'bot', dna: file, projectRoot: tmp }
      )
    ).toThrow(/does not match/);
  });
});
