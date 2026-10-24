import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Command } from 'commander';
import { registerAgentCommand } from './agent';
import { listAgentTemplates, scaffoldAgentProject } from './agent-templates';

describe('registerAgentCommand (AOS-011 + templates)', () => {
  it('registers run, logs, doctor, new, and templates subcommands', () => {
    const program = new Command();
    registerAgentCommand(program);
    const agent = program.commands.find((c) => c.name() === 'agent');
    expect(agent).toBeDefined();
    const names = agent!.commands.map((c) => c.name());
    expect(names).toEqual(
      expect.arrayContaining([
        'install',
        'dna',
        'run',
        'logs',
        'doctor',
        'runs',
        'new',
        'templates',
        'apply',
        'get',
        'describe',
        'delete',
        'events',
      ])
    );
    expect(program.commands.map((c) => c.name())).toEqual(
      expect.arrayContaining(['agents', 'agent'])
    );
  });
});

describe('agent templates scaffold', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-agent-new-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('lists local, context, bare, agent-os, and skillgate templates', () => {
    expect(listAgentTemplates().map((t) => t.id)).toEqual([
      'local',
      'context',
      'bare',
      'agent-os',
      'skillgate',
    ]);
  });

  it('scaffolds local Agent OS (default) with agent.yaml', () => {
    const dest = path.join(tmp, 'local-demo');
    const result = scaffoldAgentProject({
      name: 'local-demo',
      destDir: dest,
      template: 'local',
    });
    expect(result.files).toEqual(
      expect.arrayContaining(['package.json', 'agent.yaml', 'agent.ts', 'README.md'])
    );
    expect(result.files).not.toEqual(
      expect.arrayContaining(['host.ts', 'showcase.ts', 'demo-llm.ts'])
    );
    expect(fs.existsSync(path.join(dest, 'agent.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'agent.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'deploy/kubernetes'))).toBe(false);
    const agent = fs.readFileSync(path.join(dest, 'agent.ts'), 'utf8');
    expect(agent).toMatch(/lookup_order/);
    expect(agent).toMatch(/issue_refund/);
    expect(agent).toMatch(/requiresApproval:\s*true/);
  });

  it('scaffolds context desk with ContextService seeds', () => {
    const dest = path.join(tmp, 'context-demo');
    const result = scaffoldAgentProject({
      name: 'context-demo',
      destDir: dest,
      template: 'context',
    });
    expect(result.files).toEqual(
      expect.arrayContaining([
        'package.json',
        'agent.yaml',
        'agent.ts',
        'context.ts',
        'kb/policy.md',
        'kb/faq.md',
        'kb/graph.json',
        'scripts/walkthrough.ts',
      ])
    );
    const agent = fs.readFileSync(path.join(dest, 'agent.ts'), 'utf8');
    expect(agent).toMatch(/assemble_context/);
    expect(agent).toMatch(/issue_refund/);
    const ctx = fs.readFileSync(path.join(dest, 'context.ts'), 'utf8');
    expect(ctx).toMatch(/ContextService/);
    expect(ctx).toMatch(/createDefaultMemoryStore/);
    const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
    expect(pkg.dependencies['@hazeljs/context']).toBe('^2.0.9');
    expect(pkg.dependencies['@hazeljs/memory']).toBe('^2.0.9');
  });

  it('scaffolds bare DNA package', () => {
    const dest = path.join(tmp, 'bare-demo');
    const result = scaffoldAgentProject({ name: 'bare-demo', destDir: dest, template: 'bare' });
    expect(result.files).toContain('dna/agent.marketplace.json');
    const pkg = JSON.parse(
      fs.readFileSync(path.join(dest, 'dna/agent.marketplace.json'), 'utf8')
    ) as { dna: { format: string; name: string } };
    expect(pkg.dna.format).toBe('hazeljs.agent.dna');
    expect(pkg.dna.name).toBeTruthy();
  });

  it('scaffolds agent-os with real tool source', () => {
    const dest = path.join(tmp, 'os-demo');
    scaffoldAgentProject({ name: 'os-demo', destDir: dest, template: 'agent-os' });
    expect(fs.existsSync(path.join(dest, 'src/support.agent.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'src/main.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'src/ops/stack.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'deploy/kubernetes/hpa.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'dna/agent.marketplace.json'))).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
    expect(pkg.dependencies['@hazeljs/self-healing']).toBe('^2.0.9');
    expect(pkg.dependencies['@hazeljs/predictive-scaling']).toBe('^2.0.9');
    expect(pkg.dependencies['@hazeljs/agent']).toBe('^2.0.9');
    expect(pkg.dependencies['reflect-metadata']).toBeUndefined();
    const main = fs.readFileSync(path.join(dest, 'src/main.ts'), 'utf8');
    const agent = fs.readFileSync(path.join(dest, 'src/support.agent.ts'), 'utf8');
    expect(main).not.toMatch(/reflect-metadata/);
    expect(agent).not.toMatch(/reflect-metadata/);
  });

  it('scaffolds skillgate with openapi sample', () => {
    const dest = path.join(tmp, 'sg-demo');
    scaffoldAgentProject({ name: 'sg-demo', destDir: dest, template: 'skillgate' });
    expect(fs.existsSync(path.join(dest, 'openapi/sample.openapi.json'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'src/report.ts'))).toBe(true);
  });

  it('refuses non-empty dest without force', () => {
    const dest = path.join(tmp, 'taken');
    fs.mkdirSync(dest);
    fs.writeFileSync(path.join(dest, 'x.txt'), 'x');
    expect(() => scaffoldAgentProject({ name: 'taken', destDir: dest, template: 'bare' })).toThrow(
      /not empty/
    );
  });
});
