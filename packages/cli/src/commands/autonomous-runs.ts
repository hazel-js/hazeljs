/**
 * Autonomous run inspection helpers for `hazel runs timeline|replay|diff|inspect-aar`.
 * Extends existing local-os `hazel runs` without replacing hazeld list behavior.
 */
import type { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

interface AarFileRun {
  id: string;
  status?: string;
  serviceId?: string;
  agentName?: string;
  metadata?: {
    kind?: string;
    phase?: string;
    decision?: unknown;
    capabilityId?: string;
    timeline?: Array<{ at: string; type: string; detail?: string }>;
    effectStatus?: string;
    dryRun?: boolean;
  };
  output?: unknown;
}

function loadRuns(filePath: string): AarFileRun[] {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    return [];
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  const parsed = JSON.parse(raw) as AarFileRun[] | { runs?: AarFileRun[] };
  if (Array.isArray(parsed)) return parsed;
  return parsed.runs ?? [];
}

function printTimeline(run: AarFileRun): void {
  const events = run.metadata?.timeline ?? [];
  if (events.length === 0) {
    // eslint-disable-next-line no-console
    console.log('(no timeline events)');
    return;
  }
  for (const e of events) {
    // eslint-disable-next-line no-console
    console.log(`${e.at}  ${e.type}${e.detail ? ` — ${e.detail}` : ''}`);
  }
}

export function registerAutonomousRunCommands(program: Command): void {
  const defaultStore = path.join('.hazel', 'runs', 'aar-runs.json');

  program
    .command('runs-timeline')
    .alias('runs:timeline')
    .description('Print autonomous run timeline (from aar-runs.json)')
    .argument('<runId>', 'Autonomous run id')
    .option('--store <path>', 'AAR runs JSON path', defaultStore)
    .action((runId: string, opts: { store: string }) => {
      const runs = loadRuns(opts.store);
      const run = runs.find((r) => r.id === runId);
      if (!run) {
        // eslint-disable-next-line no-console
        console.error(`Run not found: ${runId}`);
        process.exitCode = 1;
        return;
      }
      printTimeline(run);
    });

  program
    .command('runs-replay')
    .alias('runs:replay')
    .description('Dry-run replay summary for an autonomous run (never repeats side effects)')
    .argument('<runId>', 'Autonomous run id')
    .option('--store <path>', 'AAR runs JSON path', defaultStore)
    .option('--dry-run', 'Recorded dry-run only (default)', true)
    .action((runId: string, opts: { store: string }) => {
      const runs = loadRuns(opts.store);
      const run = runs.find((r) => r.id === runId);
      if (!run) {
        // eslint-disable-next-line no-console
        console.error(`Run not found: ${runId}`);
        process.exitCode = 1;
        return;
      }
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            mode: 'dry-run',
            sourceRunId: runId,
            phase: run.metadata?.phase,
            decision: run.metadata?.decision,
            capabilityId: run.metadata?.capabilityId,
            effectStatus: run.metadata?.effectStatus,
            note: 'Dry-run replay uses recorded outputs only — no live side effects.',
          },
          null,
          2
        )
      );
    });

  program
    .command('runs-diff')
    .alias('runs:diff')
    .description('Diff two autonomous runs')
    .argument('<runA>', 'First run id')
    .argument('<runB>', 'Second run id')
    .option('--store <path>', 'AAR runs JSON path', defaultStore)
    .action((runA: string, runB: string, opts: { store: string }) => {
      const runs = loadRuns(opts.store);
      const a = runs.find((r) => r.id === runA);
      const b = runs.find((r) => r.id === runB);
      if (!a || !b) {
        // eslint-disable-next-line no-console
        console.error('Both runs required');
        process.exitCode = 1;
        return;
      }
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            runA,
            runB,
            phase: { a: a.metadata?.phase, b: b.metadata?.phase },
            decision: { a: a.metadata?.decision, b: b.metadata?.decision },
            capabilityId: { a: a.metadata?.capabilityId, b: b.metadata?.capabilityId },
            status: { a: a.status, b: b.status },
            effectStatus: { a: a.metadata?.effectStatus, b: b.metadata?.effectStatus },
          },
          null,
          2
        )
      );
    });

  program
    .command('runs-inspect')
    .alias('runs:inspect')
    .description('Inspect an autonomous run record')
    .argument('<runId>', 'Autonomous run id')
    .option('--store <path>', 'AAR runs JSON path', defaultStore)
    .option('--json', 'JSON output', true)
    .action((runId: string, opts: { store: string }) => {
      const runs = loadRuns(opts.store);
      const run = runs.find((r) => r.id === runId);
      if (!run) {
        // eslint-disable-next-line no-console
        console.error(`Run not found: ${runId}`);
        process.exitCode = 1;
        return;
      }
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(run, null, 2));
    });
}
