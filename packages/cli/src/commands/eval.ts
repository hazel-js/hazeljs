import { Command } from 'commander';
import * as path from 'path';

/**
 * `hazel eval <dataset.json>` — load a golden dataset and run a placeholder pass-through runner.
 * Wire your own runner in app code using @hazeljs/eval (see runGoldenDataset).
 */
export function registerEvalCommand(program: Command): void {
  program
    .command('eval')
    .description(
      'Run a golden dataset JSON through @hazeljs/eval (smoke check; supply your runner in code)'
    )
    .argument('<dataset>', 'Path to golden dataset JSON')
    .option('--ci', 'Set exit code 1 when eval fails thresholds')
    .action(async (dataset: string, opts: { ci?: boolean }) => {
      try {
        const { loadGoldenDatasetFromJson, runGoldenDataset, reportEvalForCi } =
          await import('@hazeljs/eval');
        const ds = loadGoldenDatasetFromJson(path.resolve(process.cwd(), dataset));
        const result = await runGoldenDataset(
          ds,
          async ({ input }: { id: string; input: string }) => ({
            output: input,
            toolCalls: [] as string[],
            retrievedIds: [] as string[],
          }),
          { minAverageScore: 0 }
        );
        reportEvalForCi(result, { exitOnFail: Boolean(opts.ci) });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exitCode = 1;
      }
    });
}
