import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerStoreCommand } from './store';

describe('registerStoreCommand (G2 Package+Store)', () => {
  it('registers store subcommands and install alias', () => {
    const program = new Command();
    registerStoreCommand(program);
    const store = program.commands.find((c) => c.name() === 'store');
    expect(store).toBeDefined();
    const names = store!.commands.map((c) => c.name());
    expect(names).toEqual(
      expect.arrayContaining(['publish', 'install', 'list', 'remove', 'doctor'])
    );
    expect(program.commands.some((c) => c.name() === 'install')).toBe(true);
  });

  it('publish then install materializes support-desk style package', async () => {
    const { exportAgentDna, toMarketplacePackage, saveMarketplacePackage } = await import(
      '@hazeljs/agent'
    );

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-store-cli-'));
    const registryDir = path.join(tmp, 'registry');
    const projectDir = path.join(tmp, 'project');
    fs.mkdirSync(projectDir);

    const dna = exportAgentDna({
      name: 'support-desk',
      version: '1.0.0',
      tools: [{ name: 'lookupOrder' }],
    });
    const pkg = toMarketplacePackage(dna);
    pkg.name = '@hazeljs/support-desk-agent';
    const pkgFile = path.join(tmp, 'support-desk.marketplace.json');
    saveMarketplacePackage(pkg, pkgFile);

    const program = new Command();
    registerStoreCommand(program);

    await program.parseAsync(
      ['store', 'publish', pkgFile, '--registry', registryDir],
      { from: 'user' }
    );
    expect(process.exitCode ?? 0).toBe(0);

    await program.parseAsync(
      [
        'store',
        'install',
        '@hazeljs/support-desk-agent@1.0.0',
        '--cwd',
        projectDir,
        '--registry',
        registryDir,
      ],
      { from: 'user' }
    );
    expect(process.exitCode ?? 0).toBe(0);

    const lockPath = path.join(projectDir, '.hazel', 'agents', 'lock.json');
    expect(fs.existsSync(lockPath)).toBe(true);
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as Record<
      string,
      { version: string }
    >;
    expect(lock['@hazeljs/support-desk-agent']?.version).toBe('1.0.0');

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('publishes and installs real starter support-desk.marketplace.json', async () => {
    const pkgFile = path.resolve(
      __dirname,
      '../../../../../hazeljs-agent-os-starter/dna/support-desk.marketplace.json'
    );
    expect(fs.existsSync(pkgFile)).toBe(true);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-store-starter-'));
    const registryDir = path.join(tmp, 'registry');
    const projectDir = path.join(tmp, 'project');
    fs.mkdirSync(projectDir);

    const program = new Command();
    registerStoreCommand(program);
    process.exitCode = 0;

    await program.parseAsync(['store', 'publish', pkgFile, '--registry', registryDir], {
      from: 'user',
    });
    expect(process.exitCode ?? 0).toBe(0);

    await program.parseAsync(
      [
        'store',
        'install',
        '@hazeljs/support-desk-agent',
        '--cwd',
        projectDir,
        '--registry',
        registryDir,
      ],
      { from: 'user' }
    );
    expect(process.exitCode ?? 0).toBe(0);

    const packageJson = path.join(
      projectDir,
      '.hazel',
      'agents',
      'hazeljs__support-desk-agent',
      'package.json'
    );
    expect(fs.existsSync(packageJson)).toBe(true);
    const loaded = JSON.parse(fs.readFileSync(packageJson, 'utf8')) as {
      name: string;
      dna: { name: string };
    };
    expect(loaded.name).toBe('@hazeljs/support-desk-agent');
    expect(loaded.dna.name).toBe('support-desk');

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
