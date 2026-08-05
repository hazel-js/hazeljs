import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

/**
 * `hazel skillgate from-openapi <file>` — preview governed skills from an OpenAPI doc.
 * `hazel skillgate init` — write a starter skillgate.config.json.
 */
export function registerSkillgateCommand(program: Command): void {
  const skillgate = program
    .command('skillgate')
    .description('Skillgate — OpenAPI → curated, governed agent skills');

  skillgate
    .command('from-openapi')
    .description('Parse an OpenAPI JSON file and print the Skillgate report')
    .argument('<file>', 'Path to OpenAPI JSON')
    .option('--mode <mode>', 'Include mode: opt-in | all', 'opt-in')
    .option('--tags <tags>', 'Comma-separated tag allowlist')
    .option('--allow-destructive', 'Allow DELETE / destructive methods')
    .option('--allow-admin', 'Allow admin / internal paths')
    .option('--base-url <url>', 'Override servers[0].url for invokers')
    .option('--json', 'Print raw JSON report')
    .action(
      async (
        file: string,
        opts: {
          mode?: string;
          tags?: string;
          allowDestructive?: boolean;
          allowAdmin?: boolean;
          baseUrl?: string;
          json?: boolean;
        }
      ) => {
        try {
          const { Skillgate } = await import('@hazeljs/skillgate');
          const abs = path.resolve(process.cwd(), file);
          const raw = fs.readFileSync(abs, 'utf8');
          const spec = JSON.parse(raw) as Record<string, unknown>;

          const gate = Skillgate.fromOpenApi(spec, {
            include: {
              mode: opts.mode === 'all' ? 'all' : 'opt-in',
              tags: opts.tags
                ? opts.tags
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                : undefined,
            },
            classify: {
              allowDestructive: Boolean(opts.allowDestructive),
              allowAdmin: Boolean(opts.allowAdmin),
            },
            invoke: opts.baseUrl ? { baseUrl: opts.baseUrl } : undefined,
            force: true,
          });

          const report = gate.report();
          if (opts.json) {
            // eslint-disable-next-line no-console
            console.log(JSON.stringify(report, null, 2));
            return;
          }

          // eslint-disable-next-line no-console
          console.log(
            JSON.stringify(
              {
                included: report.included.map((s) => ({
                  name: s.name,
                  class: s.class,
                  method: s.method,
                  path: s.path,
                  readOnly: s.readOnly,
                  requiresApproval: s.requiresApproval,
                })),
                denied: report.denied.map((s) => ({
                  name: s.name,
                  reason: s.denyReason,
                })),
                warnings: report.warnings,
                next: 'gate.register(toolRegistry, "your-agent")',
              },
              null,
              2
            )
          );
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          process.exitCode = 1;
        }
      }
    );

  skillgate
    .command('init')
    .description('Write a starter skillgate.config.json in the current directory')
    .option('--force', 'Overwrite existing file')
    .action((opts: { force?: boolean }) => {
      const out = path.resolve(process.cwd(), 'skillgate.config.json');
      if (fs.existsSync(out) && !opts.force) {
        // eslint-disable-next-line no-console
        console.error(`Refusing to overwrite ${out} (pass --force)`);
        process.exitCode = 1;
        return;
      }
      const starter = {
        $schema: 'https://hazeljs.ai/schemas/skillgate.config.json',
        include: {
          mode: 'opt-in',
          tags: ['agent', 'skillgate'],
        },
        classify: {
          writeRequiresApproval: true,
          allowDestructive: false,
          allowAdmin: false,
        },
        invoke: {
          baseUrl: 'http://127.0.0.1:3000',
          headers: {
            Authorization: 'Bearer ${API_TOKEN}',
          },
        },
        warnAbove: 12,
        maxTools: 24,
        agentName: 'api-concierge',
      };
      fs.writeFileSync(out, JSON.stringify(starter, null, 2) + '\n');
      // eslint-disable-next-line no-console
      console.log(`Wrote ${out}`);
    });
}
