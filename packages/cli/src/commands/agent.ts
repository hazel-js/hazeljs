import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

/**
 * `hazel agent install <file.dna.json>` — validate / print marketplace install plan.
 * Live hot-reload happens in-process via AgentRuntime.installAgentPackage().
 */
export function registerAgentCommand(program: Command): void {
  const agent = program.command('agent').description('Agent OS DNA / marketplace helpers');

  agent
    .command('install')
    .description('Validate a .dna / marketplace JSON package and print install plan')
    .argument('<file>', 'Path to .dna.json or marketplace package JSON')
    .option('--out <dir>', 'Write normalized marketplace package JSON to directory')
    .action(async (file: string, opts: { out?: string }) => {
      try {
        const { loadMarketplacePackage, saveMarketplacePackage } = await import('@hazeljs/agent');
        const pkg = loadMarketplacePackage(path.resolve(process.cwd(), file));
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            {
              package: pkg.name,
              version: pkg.version,
              agent: pkg.dna.name,
              tools: pkg.dna.tools.map((t: { name: string }) => t.name),
              hasPolicies: Boolean(pkg.dna.policies?.length),
              note: 'Call runtime.installAgentPackage(path) in your app to hot-reload',
            },
            null,
            2
          )
        );
        if (opts.out) {
          const outPath = path.join(opts.out, `${pkg.dna.name}.marketplace.json`);
          saveMarketplacePackage(pkg, outPath);
          // eslint-disable-next-line no-console
          console.log(`Wrote ${outPath}`);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exitCode = 1;
      }
    });

  agent
    .command('dna')
    .description('Print / validate Agent DNA JSON')
    .argument('<file>', 'Path to DNA JSON')
    .action(async (file: string) => {
      try {
        const { parseDna } = await import('@hazeljs/agent');
        const raw = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
        const dna = parseDna(raw);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(dna, null, 2));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exitCode = 1;
      }
    });
}
