import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

interface RegistryCliOpts {
  registry?: string;
  remote?: string;
  token?: string;
}

async function resolveRegistry(opts: RegistryCliOpts) {
  const { createAgentPackageRegistry } = await import('@hazeljs/agent');
  return createAgentPackageRegistry({
    remote: opts.remote,
    token: opts.token,
    registryRoot: opts.registry,
  });
}

function registryOptions(cmd: Command): Command {
  return cmd
    .option('--registry <dir>', 'Local registry root (default: ~/.hazel/registry)')
    .option(
      '--remote <url>',
      'Hosted registry base URL (Cloud Team SKU; env HAZEL_REGISTRY_URL)'
    )
    .option(
      '--token <token>',
      'Bearer token for hosted registry (env HAZEL_REGISTRY_TOKEN)'
    );
}

async function publishAction(file: string, opts: RegistryCliOpts): Promise<void> {
  const { loadMarketplacePackage } = await import('@hazeljs/agent');
  const pkg = loadMarketplacePackage(path.resolve(process.cwd(), file));
  const registry = await resolveRegistry(opts);
  await registry.publish(pkg);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'publish',
        package: pkg.name,
        version: pkg.version,
        registry: registry.location,
        kind: registry.kind,
      },
      null,
      2
    )
  );
}

async function installAction(
  spec: string,
  opts: RegistryCliOpts & { cwd: string }
): Promise<void> {
  const { loadMarketplacePackage, materializeAgentPackage, parsePackageSpec } =
    await import('@hazeljs/agent');

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
    const registry = await resolveRegistry(opts);
    pkg = await registry.get(name, version);
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
 * `hazel store publish|install|list|remove|doctor` — local or hosted Agent OS package registry.
 * Hosted (Cloud Team SKU): `--remote <url> --token <token>` or HAZEL_REGISTRY_URL / HAZEL_REGISTRY_TOKEN.
 * `hazel install` aliases `hazel store install`.
 */
export function registerStoreCommand(program: Command): void {
  const store = program
    .command('store')
    .description(
      'Agent OS package registry — local filesystem or hosted (--remote) Cloud Team registry'
    );

  registryOptions(
    store
      .command('publish')
      .description('Publish a marketplace / DNA JSON package to the registry')
      .argument('<file>', 'Path to .dna.json or marketplace package JSON')
  ).action(async (file: string, opts: RegistryCliOpts) => {
    try {
      await publishAction(file, opts);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }
  });

  registryOptions(
    store
      .command('install')
      .description(
        'Install a package into the project (.hazel/agents). Spec: path, name, or name@version'
      )
      .argument('<spec>', 'File path or package name[@version]')
      .option('--cwd <dir>', 'Project root', '.')
  ).action(async (spec: string, opts: RegistryCliOpts & { cwd: string }) => {
    try {
      await installAction(spec, opts);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }
  });

  registryOptions(
    store
      .command('list')
      .description('List packages in the registry')
      .argument('[query]', 'Optional name/description filter')
  ).action(async (query: string | undefined, opts: RegistryCliOpts) => {
    try {
      const registry = await resolveRegistry(opts);
      const packages = await registry.list(query);
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          { ok: true, kind: registry.kind, registry: registry.location, packages },
          null,
          2
        )
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }
  });

  registryOptions(
    store
      .command('remove')
      .description('Remove a package (or one version) from the registry')
      .argument('<spec>', 'name or name@version')
  ).action(async (spec: string, opts: RegistryCliOpts) => {
    try {
      const { parsePackageSpec } = await import('@hazeljs/agent');
      const { name, version } = parsePackageSpec(spec);
      const registry = await resolveRegistry(opts);
      await registry.remove(name, version);
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            ok: true,
            action: 'remove',
            name,
            version: version ?? '*',
            kind: registry.kind,
            registry: registry.location,
          },
          null,
          2
        )
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }
  });

  registryOptions(
    store.command('doctor').description('Check registry health (local or remote)')
  ).action(async (opts: RegistryCliOpts) => {
    try {
      const registry = await resolveRegistry(opts);
      const report = await registry.doctor();
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          { ...report, kind: registry.kind, registry: registry.location },
          null,
          2
        )
      );
      if (!report.ok) process.exitCode = 1;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }
  });

  registryOptions(
    program
      .command('install')
      .description('Alias for hazel store install')
      .argument('<spec>', 'File path or package name[@version]')
      .option('--cwd <dir>', 'Project root', '.')
  ).action(async (spec: string, opts: RegistryCliOpts & { cwd: string }) => {
    try {
      await installAction(spec, opts);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    }
  });
}
