import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

async function publishAction(file: string, opts: { registry?: string }): Promise<void> {
  const { loadMarketplacePackage, LocalFsAgentRegistry } = await import('@hazeljs/agent');
  const pkg = loadMarketplacePackage(path.resolve(process.cwd(), file));
  const registry = new LocalFsAgentRegistry({ rootDir: opts.registry });
  registry.publish(pkg);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'publish',
        package: pkg.name,
        version: pkg.version,
        registry: registry.rootDir,
      },
      null,
      2
    )
  );
}

async function installAction(
  spec: string,
  opts: { cwd: string; registry?: string }
): Promise<void> {
  const {
    loadMarketplacePackage,
    LocalFsAgentRegistry,
    materializeAgentPackage,
    parsePackageSpec,
  } = await import('@hazeljs/agent');

  const projectRoot = path.resolve(process.cwd(), opts.cwd);
  const resolvedPath = path.resolve(process.cwd(), spec);
  const looksLikeFile =
    spec.includes(path.sep) ||
    spec.includes('/') ||
    spec.endsWith('.json') ||
    fs.existsSync(resolvedPath);

  let pkg;
  if (looksLikeFile && fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    pkg = loadMarketplacePackage(resolvedPath);
  } else {
    const { name, version } = parsePackageSpec(spec);
    const registry = new LocalFsAgentRegistry({ rootDir: opts.registry });
    pkg = registry.resolve(name, version);
  }

  const result = materializeAgentPackage(pkg, projectRoot);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'install',
        package: result.packageName,
        version: result.version,
        path: result.packagePath,
        lock: result.lockPath,
        note: 'Use hazel agent run with the materialized package DNA, or runtime.installAgentPackage for hot-reload',
      },
      null,
      2
    )
  );
}

/**
 * `hazel store publish|install|list|remove|doctor` — local Agent OS package registry (G2).
 * `hazel install` aliases `hazel store install`.
 */
export function registerStoreCommand(program: Command): void {
  const store = program
    .command('store')
    .description('Local Agent OS package registry (publish / install DNA packages)');

  store
    .command('publish')
    .description('Publish a marketplace / DNA JSON package to the local registry')
    .argument('<file>', 'Path to .dna.json or marketplace package JSON')
    .option('--registry <dir>', 'Override registry root (default: ~/.hazel/registry)')
    .action(async (file: string, opts: { registry?: string }) => {
      try {
        await publishAction(file, opts);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  store
    .command('install')
    .description(
      'Install a package into the project (.hazel/agents). Spec: path, name, or name@version from local registry'
    )
    .argument('<spec>', 'File path or package name[@version] from local registry')
    .option('--cwd <dir>', 'Project root', '.')
    .option('--registry <dir>', 'Override registry root')
    .action(async (spec: string, opts: { cwd: string; registry?: string }) => {
      try {
        await installAction(spec, opts);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  store
    .command('list')
    .description('List packages in the local registry')
    .argument('[query]', 'Optional name/description filter')
    .option('--registry <dir>', 'Override registry root')
    .action(async (query: string | undefined, opts: { registry?: string }) => {
      try {
        const { LocalFsAgentRegistry } = await import('@hazeljs/agent');
        const registry = new LocalFsAgentRegistry({ rootDir: opts.registry });
        const packages = registry.list(query);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ ok: true, packages }, null, 2));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  store
    .command('remove')
    .description('Remove a package (or one version) from the local registry')
    .argument('<spec>', 'name or name@version')
    .option('--registry <dir>', 'Override registry root')
    .action(async (spec: string, opts: { registry?: string }) => {
      try {
        const { LocalFsAgentRegistry, parsePackageSpec } = await import('@hazeljs/agent');
        const { name, version } = parsePackageSpec(spec);
        const registry = new LocalFsAgentRegistry({ rootDir: opts.registry });
        registry.remove(name, version);
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({ ok: true, action: 'remove', name, version: version ?? '*' }, null, 2)
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  store
    .command('doctor')
    .description('Check local registry health')
    .option('--registry <dir>', 'Override registry root')
    .action(async (opts: { registry?: string }) => {
      try {
        const { LocalFsAgentRegistry } = await import('@hazeljs/agent');
        const registry = new LocalFsAgentRegistry({ rootDir: opts.registry });
        const report = registry.doctor();
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ ...report, registry: registry.rootDir }, null, 2));
        if (!report.ok) process.exitCode = 1;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  program
    .command('install')
    .description('Alias for hazel store install')
    .argument('<spec>', 'File path or package name[@version]')
    .option('--cwd <dir>', 'Project root', '.')
    .option('--registry <dir>', 'Override registry root')
    .action(async (spec: string, opts: { cwd: string; registry?: string }) => {
      try {
        await installAction(spec, opts);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });
}
