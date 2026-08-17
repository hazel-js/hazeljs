import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

/**
 * `hazel gatekeeper validate --config agent-gatekeeper.yaml`
 * `hazel gatekeeper simulate --agent refund-agent --tool stripe.refund --input input.json`
 * `hazel gatekeeper explain --invocation invocation.json`
 */
export function registerGatekeeperCommand(program: Command): void {
  const gatekeeper = program
    .command('gatekeeper')
    .description('Agent Gatekeeper — validate, simulate, and explain tool authorization policies');

  gatekeeper
    .command('validate')
    .description('Validate an agent-gatekeeper.yaml policy file')
    .option('--config <file>', 'Policy config file', 'agent-gatekeeper.yaml')
    .option('--json', 'Print raw JSON result')
    .action(async (opts: { config?: string; json?: boolean }) => {
      try {
        const { loadPoliciesFromFileSync, validatePolicies } =
          await import('@hazeljs/agent-gatekeeper');
        const abs = path.resolve(process.cwd(), opts.config ?? 'agent-gatekeeper.yaml');
        const loaded = loadPoliciesFromFileSync(fs, abs);
        validatePolicies(loaded.policies);
        const result = {
          valid: true,
          config: abs,
          policyCount: loaded.policies.length,
          mode: loaded.mode,
          defaultDecision: loaded.defaultDecision,
          policies: loaded.policies.map((p) => ({
            id: p.id,
            version: p.version,
            priority: p.priority,
          })),
        };
        // eslint-disable-next-line no-console
        console.log(opts.json ? JSON.stringify(result, null, 2) : JSON.stringify(result, null, 2));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exitCode = 1;
      }
    });

  gatekeeper
    .command('simulate')
    .description('Simulate gatekeeper decision for an invocation (never executes tools)')
    .requiredOption('--agent <id>', 'Agent id')
    .requiredOption('--tool <name>', 'Tool name')
    .option('--input <file>', 'JSON input file')
    .option('--environment <env>', 'Environment', 'development')
    .option('--tenant <id>', 'Tenant id')
    .option('--config <file>', 'Optional policy YAML file')
    .option('--json', 'Print raw JSON')
    .action(
      async (opts: {
        agent: string;
        tool: string;
        input?: string;
        environment?: string;
        tenant?: string;
        config?: string;
        json?: boolean;
      }) => {
        try {
          const { AgentGatekeeper, loadPoliciesFromFileSync, defaultClock, defaultIdGenerator } =
            await import('@hazeljs/agent-gatekeeper');

          let policies: import('@hazeljs/agent-gatekeeper').AgentGatekeeperPolicy[] = [];
          let mode: import('@hazeljs/agent-gatekeeper').GatekeeperMode = 'enforce';
          let defaultDecision: import('@hazeljs/agent-gatekeeper').DefaultDecision = 'deny';

          if (opts.config) {
            const abs = path.resolve(process.cwd(), opts.config);
            const loaded = loadPoliciesFromFileSync(fs, abs);
            policies = loaded.policies;
            mode = loaded.mode ?? mode;
            defaultDecision = loaded.defaultDecision ?? defaultDecision;
          }

          let input: Record<string, unknown> = {};
          if (opts.input) {
            const raw = fs.readFileSync(path.resolve(process.cwd(), opts.input), 'utf8');
            input = JSON.parse(raw) as Record<string, unknown>;
          }

          const gk = new AgentGatekeeper({
            mode,
            defaultDecision,
            policies,
            auditSink: { emit: () => undefined },
          });

          const context = {
            invocationId: defaultIdGenerator()(),
            runId: 'simulate-run',
            agentId: opts.agent,
            tenantId: opts.tenant,
            toolName: opts.tool,
            input,
            environment: opts.environment ?? 'development',
            timestamp: defaultClock().now(),
          };

          const simulation = await gk.simulate(context);
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(simulation, null, 2));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          process.exitCode = 1;
        }
      }
    );

  gatekeeper
    .command('explain')
    .description('Explain gatekeeper decision from a saved invocation JSON file')
    .argument('<file>', 'Invocation context JSON file')
    .option('--config <file>', 'Optional policy YAML file')
    .option('--json', 'Print raw JSON')
    .action(async (file: string, opts: { config?: string; json?: boolean }) => {
      try {
        const { AgentGatekeeper, loadPoliciesFromFileSync, defaultClock } =
          await import('@hazeljs/agent-gatekeeper');

        let policies: import('@hazeljs/agent-gatekeeper').AgentGatekeeperPolicy[] = [];
        if (opts.config) {
          const abs = path.resolve(process.cwd(), opts.config);
          policies = loadPoliciesFromFileSync(fs, abs).policies;
        }

        const raw = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const context = {
          ...parsed,
          timestamp: parsed.timestamp ? new Date(String(parsed.timestamp)) : defaultClock().now(),
        } as import('@hazeljs/agent-gatekeeper').ToolInvocationContext;

        const gk = new AgentGatekeeper({
          mode: 'enforce',
          defaultDecision: 'deny',
          policies,
          auditSink: { emit: () => undefined },
        });

        const simulation = await gk.simulate(context);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(simulation, null, 2));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exitCode = 1;
      }
    });
}
