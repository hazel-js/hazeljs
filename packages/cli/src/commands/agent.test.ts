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
      expect.arrayContaining([
        'package.json',
        'agent.yaml',
        'agents/index.ts',
        'agents/desk.agent.ts',
        'README.md',
        '.env.example',
      ])
    );
    expect(result.files).not.toEqual(
      expect.arrayContaining(['host.ts', 'showcase.ts', 'demo-llm.ts', 'agent.ts'])
    );
    expect(fs.existsSync(path.join(dest, 'agent.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'agents/index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'agents/desk.agent.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'agent.ts'))).toBe(false);
    expect(fs.existsSync(path.join(dest, '.env.example'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'deploy/kubernetes'))).toBe(false);
    const agent = fs.readFileSync(path.join(dest, 'agents/desk.agent.ts'), 'utf8');
    expect(agent).toMatch(/lookup_order/);
    expect(agent).toMatch(/issue_refund/);
    expect(agent).toMatch(/requiresApproval:\s*true/);
    const barrel = fs.readFileSync(path.join(dest, 'agents/index.ts'), 'utf8');
    expect(barrel).toMatch(/desk\.agent/);
    const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
    expect(pkg.dependencies['@hazeljs/agent']).toBe('^2.1.0');
    expect(pkg.dependencies['@hazeljs/agent-gatekeeper']).toBe('^2.1.0');
    expect(pkg.dependencies['@hazeljs/config']).toBe('^2.1.0');
    expect(pkg.dependencies['reflect-metadata']).toBeUndefined();
    const readme = fs.readFileSync(path.join(dest, 'README.md'), 'utf8');
    expect(readme).toMatch(/OPENAI_API_KEY/);
    expect(readme).toMatch(/Prerequisites/);
    expect(readme).toMatch(/Getting started/);
    expect(readme).toMatch(/Add another agent/);
    expect(readme).toMatch(/Lifecycle commands/);
    expect(readme).toMatch(/hazel apply --all/);
    expect(readme).toMatch(/hazel delete/);
    const envExample = fs.readFileSync(path.join(dest, '.env.example'), 'utf8');
    expect(envExample).toMatch(/OPENAI_API_KEY=/);
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
        'agents/index.ts',
        'agents/desk.agent.ts',
        'context.ts',
        'kb/policy.md',
        'kb/faq.md',
        'kb/graph.json',
        'scripts/walkthrough.ts',
        '.env.example',
      ])
    );
    const agent = fs.readFileSync(path.join(dest, 'agents/desk.agent.ts'), 'utf8');
    expect(agent).toMatch(/assemble_context/);
    expect(agent).toMatch(/issue_refund/);
    expect(agent).toMatch(/from '\.\.\/context'/);
    const ctx = fs.readFileSync(path.join(dest, 'context.ts'), 'utf8');
    expect(ctx).toMatch(/ContextService/);
    expect(ctx).toMatch(/createDefaultMemoryStore/);
    const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
    expect(pkg.dependencies['@hazeljs/context']).toBe('^2.1.0');
    expect(pkg.dependencies['@hazeljs/memory']).toBe('^2.1.0');
    expect(pkg.dependencies['@hazeljs/agent']).toBe('^2.1.0');
    expect(pkg.dependencies['@hazeljs/agent-gatekeeper']).toBe('^2.1.0');
    expect(pkg.dependencies['@hazeljs/config']).toBe('^2.1.0');
    expect(pkg.dependencies['reflect-metadata']).toBeUndefined();
    const readme = fs.readFileSync(path.join(dest, 'README.md'), 'utf8');
    expect(readme).toMatch(/OPENAI_API_KEY/);
    expect(readme).toMatch(/Getting started/);
    expect(readme).toMatch(/Add another agent/);
    expect(readme).toMatch(/Lifecycle commands/);
    expect(readme).toMatch(/hazel apply --all/);
    expect(readme).toMatch(/hazel delete/);
  });

  it('scaffolds bare DNA package', () => {
    const dest = path.join(tmp, 'bare-demo');
    const result = scaffoldAgentProject({ name: 'bare-demo', destDir: dest, template: 'bare' });
    expect(result.files).toContain('dna/agent.marketplace.json');
    expect(result.files).toContain('.env.example');
    const pkg = JSON.parse(
      fs.readFileSync(path.join(dest, 'dna/agent.marketplace.json'), 'utf8')
    ) as { dna: { format: string; name: string } };
    expect(pkg.dna.format).toBe('hazeljs.agent.dna');
    expect(pkg.dna.name).toBeTruthy();
    const rootPkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
    expect(rootPkg.dependencies['@hazeljs/agent']).toBe('^2.1.0');
    const readme = fs.readFileSync(path.join(dest, 'README.md'), 'utf8');
    expect(readme).toMatch(/OPENAI_API_KEY/);
    expect(readme).toMatch(/Getting started/);
    expect(readme).toMatch(/store publish/);
    expect(readme).toMatch(/stub/);
  });

  it('scaffolds agent-os with real tool source', () => {
    const dest = path.join(tmp, 'os-demo');
    scaffoldAgentProject({ name: 'os-demo', destDir: dest, template: 'agent-os' });
    expect(fs.existsSync(path.join(dest, 'src/support.agent.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'src/main.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'src/ops/stack.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'deploy/kubernetes/hpa.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'dna/agent.marketplace.json'))).toBe(true);
    expect(fs.existsSync(path.join(dest, '.env.example'))).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
    expect(pkg.dependencies['@hazeljs/self-healing']).toBe('^2.1.0');
    expect(pkg.dependencies['@hazeljs/predictive-scaling']).toBe('^2.1.0');
    expect(pkg.dependencies['@hazeljs/agent']).toBe('^2.1.0');
    expect(pkg.dependencies['@hazeljs/config']).toBe('^2.1.0');
    expect(pkg.dependencies['@hazeljs/core']).toBe('^2.1.0');
    expect(pkg.dependencies['reflect-metadata']).toBeUndefined();
    const main = fs.readFileSync(path.join(dest, 'src/main.ts'), 'utf8');
    expect(main).not.toMatch(/reflect-metadata/);
    expect(main).toMatch(/resolveLlmFromEnv/);
    const envExample = fs.readFileSync(path.join(dest, '.env.example'), 'utf8');
    expect(envExample).toMatch(/OPENAI_API_KEY=/);
    const readme = fs.readFileSync(path.join(dest, 'README.md'), 'utf8');
    expect(readme).toMatch(/OPENAI_API_KEY/);
    expect(readme).toMatch(/Getting started/);
    expect(readme).toMatch(/npm run dev/);
    expect(readme).toMatch(/Add \/ change tools/);
  });

  it('scaffolds skillgate with openapi sample', () => {
    const dest = path.join(tmp, 'sg-demo');
    scaffoldAgentProject({ name: 'sg-demo', destDir: dest, template: 'skillgate' });
    expect(fs.existsSync(path.join(dest, 'openapi/sample.openapi.json'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'src/report.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dest, '.env.example'))).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
    expect(pkg.dependencies['@hazeljs/agent']).toBe('^2.1.0');
    const readme = fs.readFileSync(path.join(dest, 'README.md'), 'utf8');
    expect(readme).toMatch(/OPENAI_API_KEY/);
    expect(readme).toMatch(/Getting started/);
    expect(readme).toMatch(/npm run report/);
    expect(readme).toMatch(/Customize/);
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
