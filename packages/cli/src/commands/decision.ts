import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

/**
 * `hazel decision run --state state.json --choices retry,rollback`
 * `hazel decision compare --providers hazel-agent,mock`
 * `hazel decision flow --risk high`
 * `hazel decision lab` — run + print pipeline graph
 */

function parseChoices(raw?: string): string[] {
  return (raw ?? 'retry,rollback,escalate,ignore')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

function loadJsonFile(file?: string): unknown {
  if (!file) return undefined;
  const abs = path.resolve(process.cwd(), file);
  return JSON.parse(fs.readFileSync(abs, 'utf8')) as unknown;
}

function print(value: unknown, asJson?: boolean): void {
  // eslint-disable-next-line no-console
  console.log(asJson ? JSON.stringify(value, null, 2) : JSON.stringify(value, null, 2));
}

export function registerDecisionCommand(program: Command): void {
  const decision = program
    .command('decision')
    .description(
      'Decision Runtime — run, compare, and project governed decisions (@hazeljs/decision)'
    );

  decision
    .command('run')
    .description('Run a governed decision (never executes capabilities unless --execute)')
    .option('--name <name>', 'Decision definition name', 'incident-remediation')
    .option('--objective <text>', 'Decision objective')
    .option('--state <file>', 'JSON state file')
    .option('--choices <list>', 'Comma-separated choices', 'retry,rollback,escalate,ignore')
    .option('--risk <level>', 'Risk level', 'high')
    .option('--provider <name>', 'Provider name', 'hazel-agent')
    .option(
      '--strategy <mode>',
      'Strategy: auto|fast|standard|deliberate|human-required|rules',
      'auto'
    )
    .option('--execute', 'Request capability execution (still subject to Gatekeeper)')
    .option('--json', 'Print raw JSON')
    .action(
      async (opts: {
        name?: string;
        objective?: string;
        state?: string;
        choices?: string;
        risk?: string;
        provider?: string;
        strategy?: string;
        execute?: boolean;
        json?: boolean;
      }) => {
        try {
          const { createDecisionRuntime, incidentRemediationDefinition, incidentState } =
            await import('@hazeljs/decision');

          const runtime = createDecisionRuntime();
          runtime.registry.register({
            name: 'incident-remediation',
            ...incidentRemediationDefinition,
          });

          const choices = parseChoices(opts.choices);
          const state = loadJsonFile(opts.state) ?? incidentState;
          const result = await runtime.decide({
            name: opts.name ?? 'incident-remediation',
            objective:
              opts.objective ??
              incidentRemediationDefinition.objective ??
              'Choose the safest remediation',
            state,
            choices: choices as [string, ...string[]],
            risk: (opts.risk as 'high') ?? 'high',
            provider: opts.provider ?? 'hazel-agent',
            strategy: (opts.strategy as 'auto') ?? 'auto',
            execute: opts.execute === true,
          });

          print(
            {
              id: result.id,
              decision: result.decision,
              confidence: result.confidence,
              confidenceType: result.confidenceDetail.type,
              strategy: result.strategy,
              provider: result.provider,
              risk: result.risk.level,
              policy: result.policy,
              status: result.status,
              execution: result.execution,
              latencyMs: result.latency.totalMs,
            },
            opts.json
          );
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          process.exitCode = 1;
        }
      }
    );

  decision
    .command('compare')
    .description('Shadow-compare providers (never executes capabilities)')
    .option('--name <name>', 'Decision definition name', 'incident-remediation')
    .option('--objective <text>', 'Decision objective')
    .option('--state <file>', 'JSON state file')
    .option('--choices <list>', 'Comma-separated choices', 'retry,rollback,escalate,ignore')
    .option('--risk <level>', 'Risk level', 'high')
    .option('--providers <list>', 'Comma-separated providers', 'hazel-agent,mock')
    .option('--json', 'Print raw JSON')
    .action(
      async (opts: {
        name?: string;
        objective?: string;
        state?: string;
        choices?: string;
        risk?: string;
        providers?: string;
        json?: boolean;
      }) => {
        try {
          const {
            createDecisionRuntime,
            createDecisionLab,
            incidentRemediationDefinition,
            incidentState,
          } = await import('@hazeljs/decision');

          const runtime = createDecisionRuntime();
          runtime.registry.register({
            name: 'incident-remediation',
            ...incidentRemediationDefinition,
          });

          const choices = parseChoices(opts.choices);
          const providers = (opts.providers ?? 'hazel-agent,mock')
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);

          if (providers.includes('mock') && runtime.providers.has('mock')) {
            const mock = runtime.providers.get('mock') as {
              when?: (name: string) => {
                return: (cfg: { decision: string; confidence: number }) => void;
              };
            };
            mock.when?.(opts.name ?? 'incident-remediation').return({
              decision: (choices[1] ?? choices[0]) as string,
              confidence: 0.82,
            });
          }

          const lab = createDecisionLab(runtime);
          const cmp = await lab.compare(
            {
              name: opts.name ?? 'incident-remediation',
              objective:
                opts.objective ?? incidentRemediationDefinition.objective ?? 'Decision Lab compare',
              state: loadJsonFile(opts.state) ?? incidentState,
              choices: choices as [string, ...string[]],
              risk: (opts.risk as 'high') ?? 'high',
            },
            providers
          );

          print(
            {
              agreement: cmp.agreement,
              majorityDecision: cmp.majorityDecision,
              executionForbidden: cmp.executionForbidden,
              rows: cmp.rows.map((r) => ({
                provider: r.provider,
                decision: r.decision,
                confidence: r.confidence,
                latencyMs: r.latencyMs,
                policy: r.policy,
                error: r.error,
              })),
            },
            opts.json
          );
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          process.exitCode = 1;
        }
      }
    );

  decision
    .command('flow')
    .description('Project decision pipeline as a Flow-shaped graph (no execution)')
    .option('--name <name>', 'Decision name', 'incident-remediation')
    .option('--risk <level>', 'Risk level', 'high')
    .option('--strategy <mode>', 'Strategy override', 'auto')
    .option('--json', 'Print raw JSON')
    .action(async (opts: { name?: string; risk?: string; strategy?: string; json?: boolean }) => {
      try {
        const { projectDecisionFlow } = await import('@hazeljs/decision');
        const graph = projectDecisionFlow({
          name: opts.name,
          risk: (opts.risk as 'high') ?? 'high',
          strategy: (opts.strategy as 'auto') ?? 'auto',
        });
        if (opts.json) {
          print(graph, true);
          return;
        }
        const enabled = graph.nodes.filter((n) => n.enabled).map((n) => n.label);
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            {
              flowId: graph.flowId,
              strategy: graph.strategy,
              risk: graph.risk,
              pipeline: enabled.join(' → '),
              edges: graph.edges,
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
    });

  decision
    .command('lab')
    .description('Decision Lab: run once and print pipeline graph')
    .option('--state <file>', 'JSON state file')
    .option('--risk <level>', 'Risk level', 'high')
    .option('--provider <name>', 'Provider', 'hazel-agent')
    .option('--json', 'Print raw JSON')
    .action(async (opts: { state?: string; risk?: string; provider?: string; json?: boolean }) => {
      try {
        const {
          createDecisionRuntime,
          createDecisionLab,
          incidentRemediationDefinition,
          incidentState,
        } = await import('@hazeljs/decision');

        const runtime = createDecisionRuntime();
        runtime.registry.register({
          name: 'incident-remediation',
          ...incidentRemediationDefinition,
        });
        const lab = createDecisionLab(runtime);
        const run = await lab.run({
          name: 'incident-remediation',
          objective: incidentRemediationDefinition.objective,
          state: loadJsonFile(opts.state) ?? incidentState,
          choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
          risk: (opts.risk as 'high') ?? 'high',
          provider: opts.provider ?? 'hazel-agent',
        });

        print(
          {
            decision: run.result.decision,
            confidence: run.result.confidence,
            strategy: run.result.strategy,
            policy: run.result.policy.outcome,
            graph: run.graph.map((n) => ({
              id: n.id,
              status: n.status,
              durationMs: n.durationMs,
            })),
          },
          opts.json
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exitCode = 1;
      }
    });
}
