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

  it('lists three templates', () => {
    expect(listAgentTemplates().map((t) => t.id)).toEqual(['bare', 'agent-os', 'skillgate']);
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
    expect(fs.existsSync(path.join(dest, 'dna/agent.marketplace.json'))).toBe(true);
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
