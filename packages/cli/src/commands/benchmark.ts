import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

/**
 * `hazel benchmark <cases.json> [--baseline <file>] [--ci]`
 * Smoke / commit-compare helper. Wire real agent runners in app code via @hazeljs/benchmark.
 */
export function registerBenchmarkCommand(program: Command): void {
  program
    .command('benchmark')
    .description('Run agent benchmark cases and optionally compare to a baseline JSON')
    .argument(
      '<cases>',
      'Path to benchmark cases JSON: { label?, cases: [{ id, input, expected? }] }'
    )
    .option('--baseline <file>', 'Previous BenchmarkRun JSON to compare against')
    .option('--out <file>', 'Write BenchmarkRun JSON to file')
    .option('--label <label>', 'Run label', 'local')
    .option('--commit <sha>', 'Commit SHA label')
    .option('--ci', 'Exit 1 on regressions vs baseline or failed cases')
    .action(
      async (
        casesPath: string,
        opts: { baseline?: string; out?: string; label?: string; commit?: string; ci?: boolean }
      ) => {
        try {
          const { runBenchmark, compareBenchmarkRuns } = await import('@hazeljs/benchmark');
          const raw = JSON.parse(
            fs.readFileSync(path.resolve(process.cwd(), casesPath), 'utf8')
          ) as {
            label?: string;
            cases: Array<{ id: string; input: string; expected?: string }>;
          };

          const run = await runBenchmark({
            label: opts.label ?? raw.label ?? 'local',
            commit: opts.commit,
            cases: raw.cases,
            run: async (input, id) => {
              const expected = raw.cases.find((c) => c.id === id)?.expected;
              // Smoke runner: score 1 if expected substring matches input echo, else 0.5
              const output = input;
              const score =
                expected == null
                  ? 1
                  : output.toLowerCase().includes(expected.toLowerCase())
                    ? 1
                    : 0;
              return { score, durationMs: 0, passed: score >= 0.7 };
            },
          });

          // eslint-disable-next-line no-console
          console.log(
            JSON.stringify(
              {
                label: run.label,
                commit: run.commit,
                averageScore: run.averageScore,
                passRate: run.passRate,
                cases: run.cases.length,
              },
              null,
              2
            )
          );

          if (opts.out) {
            fs.writeFileSync(path.resolve(process.cwd(), opts.out), JSON.stringify(run, null, 2));
          }

          if (opts.baseline) {
            const baseline = JSON.parse(
              fs.readFileSync(path.resolve(process.cwd(), opts.baseline), 'utf8')
            );
            const cmp = compareBenchmarkRuns(baseline, run);
            // eslint-disable-next-line no-console
            console.log(
              JSON.stringify(
                {
                  scoreDelta: cmp.scoreDelta,
                  passRateDelta: cmp.passRateDelta,
                  regressions: cmp.regressions,
                  improvements: cmp.improvements,
                },
                null,
                2
              )
            );
            if (opts.ci && cmp.regressions.length > 0) {
              process.exitCode = 1;
            }
          }

          if (opts.ci && run.passRate < 1) {
            process.exitCode = 1;
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          process.exitCode = 1;
        }
      }
    );
}
