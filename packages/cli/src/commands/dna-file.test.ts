import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extractDna, loadDnaOrYaml } from './dna-file';
import { scaffoldAgentProject } from './agent-templates';

describe('extractDna', () => {
  it('returns bare DNA unchanged', () => {
    const dna = {
      format: 'hazeljs.agent.dna',
      version: '1.0.0',
      name: 'desk',
      tools: [{ name: 'lookup_order' }],
    };
    expect(extractDna(dna)).toBe(dna);
  });

  it('unwraps { dna } marketplace-style wrapper', () => {
    const dna = { format: 'hazeljs.agent.dna', name: 'x', version: '1' };
    expect(extractDna({ dna, name: '@pkg/x' })).toEqual(dna);
  });

  it('unwraps AgentDefinition spec.dna', () => {
    const dna = {
      format: 'hazeljs.agent.dna',
      version: '1.0.0',
      name: 'my_bot',
      tools: [{ name: 'issue_refund', requiresApproval: true }],
    };
    expect(
      extractDna({
        apiVersion: 'agent.hazeljs.dev/v1alpha1',
        kind: 'AgentDefinition',
        metadata: { name: 'my_bot' },
        spec: { dna },
      })
    ).toEqual(dna);
  });

  it('accepts name + systemPrompt/tools without format', () => {
    const loose = { name: 'bot', systemPrompt: 'hi', tools: [] };
    expect(extractDna(loose)).toBe(loose);
  });

  it('passes through non-objects', () => {
    expect(extractDna(null)).toBeNull();
    expect(extractDna('raw')).toBe('raw');
  });
});

describe('loadDnaOrYaml + local template', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-dna-file-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('parses scaffolded agent.yaml into DNA with HITL tool', async () => {
    const dest = path.join(tmp, 'local-demo');
    scaffoldAgentProject({ name: 'local-demo', destDir: dest, template: 'local' });
    const yamlPath = path.join(dest, 'agent.yaml');
    expect(fs.existsSync(yamlPath)).toBe(true);

    const doc = await loadDnaOrYaml(yamlPath);
    const dna = extractDna(doc) as {
      format: string;
      name: string;
      systemPrompt?: string;
      tools?: Array<{ name: string; requiresApproval?: boolean }>;
    };

    expect(dna.format).toBe('hazeljs.agent.dna');
    expect(dna.name).toBe('local_demo');
    expect(dna.systemPrompt).toMatch(/order-support/i);
    expect(dna.tools?.map((t) => t.name)).toEqual(['lookup_order', 'issue_refund']);
    expect(dna.tools?.find((t) => t.name === 'issue_refund')?.requiresApproval).toBe(true);
  });

  it('parses JSON DNA files', async () => {
    const file = path.join(tmp, 'agent.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        format: 'hazeljs.agent.dna',
        version: '1.0.0',
        name: 'json_bot',
        tools: [{ name: 'ping' }],
      })
    );
    const dna = extractDna(await loadDnaOrYaml(file)) as { name: string };
    expect(dna.name).toBe('json_bot');
  });

  it('parses .yml extension', async () => {
    const file = path.join(tmp, 'agent.yml');
    fs.writeFileSync(
      file,
      `
format: hazeljs.agent.dna
version: "1.0.0"
name: yml_bot
tools: []
`
    );
    const dna = extractDna(await loadDnaOrYaml(file)) as { name: string };
    expect(dna.name).toBe('yml_bot');
  });
});
