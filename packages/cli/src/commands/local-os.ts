/**
 * Local-first Agent OS CLI aliases — talk to hazeld over the control socket.
 *
 * Top-level verbs (keep `hazel agent *` working):
 *   hazel new agent | apply | dev | ps | inspect | start | stop | restart | delete
 *   hazel approvals | approve | deny | secret | logs | runs | doctor | ui | run
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

function resolveHazeldScript(): string {
  return path.join(__dirname, '..', 'hazeld.js');
}

async function withDaemon<T>(fn: (ctl: typeof import('@hazeljs/agent')) => Promise<T>): Promise<T> {
  const agent = await import('@hazeljs/agent');
  await agent.ensureDaemon({
    hazeldScript: resolveHazeldScript(),
    projectRoot: process.cwd(),
  });
  return fn(agent);
}

async function ctl(
  req: import('@hazeljs/agent').ControlRequest
): Promise<import('@hazeljs/agent').ControlResponse> {
  return withDaemon(async (agent) => {
    const res = await agent.controlRequest(req);
    if (!res.ok) throw new Error(res.error ?? 'hazeld control error');
    return res;
  });
}

function printTable(rows: Array<Record<string, string>>, cols: string[]): void {
  if (!rows.length) {
    // eslint-disable-next-line no-console
    console.log('(none)');
    return;
  }
  const widths = Object.fromEntries(
    cols.map((c) => [c, Math.max(c.length, ...rows.map((r) => (r[c] ?? '').length))])
  ) as Record<string, number>;
  // eslint-disable-next-line no-console
  console.log(cols.map((c) => c.padEnd(widths[c])).join('  '));
  for (const r of rows) {
    // eslint-disable-next-line no-console
    console.log(cols.map((c) => (r[c] ?? '').padEnd(widths[c])).join('  '));
  }
}

async function loadDnaOrYaml(filePath: string): Promise<unknown> {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  if (abs.endsWith('.yaml') || abs.endsWith('.yml')) {
    const { parse } = await import('yaml');
    return parse(raw);
  }
  return JSON.parse(raw);
}

function extractDna(doc: unknown): unknown {
  if (!doc || typeof doc !== 'object') return doc;
  const o = doc as Record<string, unknown>;
  if (o.format === 'hazeljs.agent.dna') return o;
  if (o.dna && typeof o.dna === 'object') return o.dna;
  if (o.kind === 'AgentDefinition' && (o.spec as { dna?: unknown })?.dna) {
    return (o.spec as { dna: unknown }).dna;
  }
  if (o.name && (o.systemPrompt || o.mission || o.tools)) return o;
  return o;
}

export function registerLocalOsCommands(program: Command): void {
  program
    .command('apply')
    .description('Ensure hazeld is running, apply DNA / platform YAML, return to the prompt')
    .argument('[file]', 'DNA JSON/YAML or AgentDefinition', 'agent.yaml')
    .option('--json', 'Machine-readable output')
    .action(async (file: string, opts: { json?: boolean }) => {
      try {
        const doc = await loadDnaOrYaml(file);
        const dna = extractDna(doc);
        const res = await ctl({ op: 'apply', dna: dna as never });
        const agent = res.data as { name?: string; id?: string; status?: string };
        const name = agent?.name ?? agent?.id ?? 'agent';
        if (opts.json) {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify({ ok: true, agent: res.data }, null, 2));
          return;
        }
        // eslint-disable-next-line no-console
        console.log(`✓ Agent "${name}" applied`);
        // eslint-disable-next-line no-console
        console.log(`  Status: Running (hosted by hazeld)`);
        // eslint-disable-next-line no-console
        console.log(`  Inspect: hazel inspect ${name}`);
        // eslint-disable-next-line no-console
        console.log(`  Survives terminal close — daemon keeps the Agent OS node alive.`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  program
    .command('dev')
    .description('Foreground AgentOS + reconcile (dies with the TTY; use hazel apply for daemon)')
    .option('--project <path>', 'Project root', '.')
    .option('--interval <ms>', 'Reconcile interval', '5000')
    .action(async (opts: { project: string; interval: string }) => {
      try {
        const { AgentOS, watchLocalPlatform } = await import('@hazeljs/agent');
        const projectRoot = path.resolve(opts.project);
        const os = new AgentOS({ projectRoot });
        await os.recover();
        // eslint-disable-next-line no-console
        console.log('Hazel Agent OS (dev) — foreground; Ctrl+C to stop');
        // eslint-disable-next-line no-console
        console.log(`  project: ${projectRoot}`);
        const ac = new AbortController();
        process.on('SIGINT', () => ac.abort());
        process.on('SIGTERM', () => ac.abort());
        await watchLocalPlatform(os.platform, {
          intervalMs: Math.max(250, Number(opts.interval) || 5000),
          signal: ac.signal,
          onTick: async () => {
            const agents = await os.list();
            // eslint-disable-next-line no-console
            console.log(
              `[dev] ${new Date().toISOString()} agents=${agents.length} ` +
                agents.map((a) => `${a.name}:${a.status}`).join(' ')
            );
          },
        });
        await os.dispose();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  program
    .command('ps')
    .description('List agents on the local hazeld node')
    .option('--json', 'JSON output')
    .action(async (opts: { json?: boolean }) => {
      try {
        const res = await ctl({ op: 'list' });
        const agents =
          (res.data as Array<{
            name: string;
            status: string;
            occupancy?: { currentTask?: string; nextWakeAt?: string };
          }>) ?? [];
        if (opts.json) {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify({ agents }, null, 2));
          return;
        }
        const { toDisplayStatus } = await import('@hazeljs/agent');
        printTable(
          agents.map((a) => ({
            NAME: a.name,
            STATUS: toDisplayStatus(a.status as never),
            CURRENT:
              a.occupancy?.currentTask ??
              (a.status === 'sleeping' ? (a.occupancy?.nextWakeAt ?? '-') : '-'),
          })),
          ['NAME', 'STATUS', 'CURRENT']
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  program
    .command('inspect')
    .description('Inspect an agent on hazeld')
    .argument('<agentId>', 'Agent name / id')
    .option('--json', 'JSON output')
    .action(async (agentId: string, opts: { json?: boolean }) => {
      try {
        const res = await ctl({ op: 'inspect', agentId });
        if (opts.json) {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(res.data, null, 2));
          return;
        }
        const view = res.data as {
          displayStatus: string;
          agent: { name: string; status: string };
          pid?: number;
          uptimeMs?: number;
          version: string;
          runs: { total: number; successful: number; failed: number; waiting: number };
          health: { runtime: string; storage: string; gatekeeper: string };
          skills: string[];
          model?: string;
        };
        // eslint-disable-next-line no-console
        console.log(`Agent: ${view.agent.name}`);
        // eslint-disable-next-line no-console
        console.log(`  Status:     ${view.displayStatus}`);
        // eslint-disable-next-line no-console
        console.log(`  PID:        ${view.pid ?? '-'}`);
        // eslint-disable-next-line no-console
        console.log(`  Version:    ${view.version}`);
        // eslint-disable-next-line no-console
        console.log(`  Model:      ${view.model ?? '-'}`);
        // eslint-disable-next-line no-console
        console.log(
          `  Runs:       ${view.runs.total} (ok=${view.runs.successful} fail=${view.runs.failed} wait=${view.runs.waiting})`
        );
        // eslint-disable-next-line no-console
        console.log(
          `  Health:     runtime=${view.health.runtime} storage=${view.health.storage} gatekeeper=${view.health.gatekeeper}`
        );
        // eslint-disable-next-line no-console
        console.log(`  Skills:     ${view.skills.join(', ') || '(none)'}`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  for (const verb of ['start', 'stop', 'restart', 'delete'] as const) {
    const op = verb === 'delete' ? 'remove' : verb;
    program
      .command(verb)
      .description(
        verb === 'start'
          ? 'Start / run an agent on hazeld'
          : verb === 'stop'
            ? 'Pause an agent on hazeld'
            : verb === 'restart'
              ? 'Restart an agent on hazeld'
              : 'Terminate and unregister an agent on hazeld'
      )
      .argument('<agentId>', 'Agent name / id')
      .argument('[input]', 'Optional input (start only)')
      .action(async (agentId: string, input?: string) => {
        try {
          if (op === 'start') {
            await ctl({ op: 'start', agentId, input });
            // eslint-disable-next-line no-console
            console.log(`✓ Started ${agentId}`);
          } else if (op === 'stop') {
            await ctl({ op: 'stop', agentId });
            // eslint-disable-next-line no-console
            console.log(`✓ Stopped ${agentId}`);
          } else if (op === 'restart') {
            await ctl({ op: 'restart', agentId });
            // eslint-disable-next-line no-console
            console.log(`✓ Restarted ${agentId}`);
          } else {
            await ctl({ op: 'remove', agentId });
            // eslint-disable-next-line no-console
            console.log(`✓ Deleted ${agentId}`);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e instanceof Error ? e.message : e);
          process.exitCode = 1;
        }
      });
  }

  program
    .command('run')
    .description('Start a run for an agent on hazeld')
    .argument('<agentId>', 'Agent name / id')
    .argument('[input]', 'Input prompt')
    .action(async (agentId: string, input?: string) => {
      try {
        const res = await ctl({ op: 'run', agentId, input });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res.data, null, 2));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  program
    .command('approvals')
    .description('List pending Gatekeeper / HITL approvals on hazeld')
    .option('--json', 'JSON output')
    .action(async (opts: { json?: boolean }) => {
      try {
        const res = await ctl({ op: 'approvals' });
        const tasks =
          (res.data as Array<{
            id: string;
            runId: string;
            toolName?: string;
            status: string;
            createdAt?: string;
          }>) ?? [];
        if (opts.json) {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify({ approvals: tasks }, null, 2));
          return;
        }
        printTable(
          tasks.map((t) => ({
            ID: t.id,
            RUN: t.runId,
            TOOL: t.toolName ?? '-',
            STATUS: t.status,
          })),
          ['ID', 'RUN', 'TOOL', 'STATUS']
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  program
    .command('approve')
    .description('Approve a pending HumanTask / Gatekeeper approval')
    .argument('<taskId>', 'Approval / task id')
    .option('--by <who>', 'Approver identity', 'cli')
    .action(async (taskId: string, opts: { by: string }) => {
      try {
        const res = await ctl({ op: 'approve', taskId, by: opts.by });
        // eslint-disable-next-line no-console
        console.log(`✓ Approved ${taskId}`);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res.data, null, 2));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  program
    .command('deny')
    .description('Deny a pending HumanTask / Gatekeeper approval')
    .argument('<taskId>', 'Approval / task id')
    .option('--by <who>', 'Rejector identity', 'cli')
    .action(async (taskId: string, opts: { by: string }) => {
      try {
        const res = await ctl({ op: 'deny', taskId, by: opts.by });
        // eslint-disable-next-line no-console
        console.log(`✓ Denied ${taskId}`);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res.data, null, 2));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  const secret = program.command('secret').description('Manage secrets in the hazeld secret store');
  secret
    .command('set')
    .argument('<name>', 'Secret name')
    .argument('<value>', 'Secret value (not echoed after set)')
    .action(async (name: string, value: string) => {
      try {
        await ctl({ op: 'secret.set', name, value });
        // eslint-disable-next-line no-console
        console.log(`✓ Secret "${name}" set (value not displayed)`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });
  secret
    .command('delete')
    .argument('<name>', 'Secret name')
    .action(async (name: string) => {
      try {
        await ctl({ op: 'secret.delete', name });
        // eslint-disable-next-line no-console
        console.log(`✓ Secret "${name}" deleted`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });
  secret
    .command('has')
    .argument('<name>', 'Secret name')
    .action(async (name: string) => {
      try {
        const res = await ctl({ op: 'secret.has', name });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res.data));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  program
    .command('logs')
    .description('Show AgentRun timeline JSONL (alias of hazel agent logs)')
    .option(
      '--timeline <path>',
      'Timeline JSONL path',
      path.join('.hazel', 'runs', 'timeline.jsonl')
    )
    .option('--run <runId>', 'Filter by execution / run id')
    .option('--agent <name>', 'Filter by agent name')
    .option('--follow', 'Tail new lines')
    .action(async (opts: { timeline: string; run?: string; agent?: string; follow?: boolean }) => {
      try {
        const { FileTimelineStore, redactSecrets } = await import('@hazeljs/agent');
        const timelinePath = path.resolve(process.cwd(), opts.timeline);
        const store = new FileTimelineStore(timelinePath);
        const print = () => {
          // eslint-disable-next-line no-console
          console.log(
            JSON.stringify(
              redactSecrets(store.load({ executionId: opts.run, agentName: opts.agent })),
              null,
              2
            )
          );
        };
        if (!opts.follow) {
          print();
          return;
        }
        let lastSize = fs.existsSync(timelinePath) ? fs.statSync(timelinePath).size : 0;
        print();
        setInterval(() => {
          if (!fs.existsSync(timelinePath)) return;
          const size = fs.statSync(timelinePath).size;
          if (size !== lastSize) {
            lastSize = size;
            print();
          }
        }, 1000);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  program
    .command('runs')
    .description('List durable runs on hazeld')
    .argument('[agentId]', 'Optional agent filter')
    .option('--json', 'JSON output')
    .action(async (agentId: string | undefined, opts: { json?: boolean }) => {
      try {
        const res = await ctl({ op: 'runs', agentId });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res.data, null, 2));
        void opts;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  program
    .command('doctor')
    .description('Check local Agent OS node health (daemon, socket, store)')
    .option('--repair', 'Opt-in repair hints only (never auto-destructive)')
    .option('--json', 'JSON output')
    .action(async (opts: { repair?: boolean; json?: boolean }) => {
      try {
        const agent = await import('@hazeljs/agent');
        const home = agent.ensureHazelHome(agent.hazelHome());
        const checks: Array<{ ok: boolean; name: string; detail: string }> = [];
        checks.push({ ok: true, name: 'node', detail: process.version });

        const reachable = await agent.isDaemonReachable(home.socketPath);
        checks.push({
          ok: reachable,
          name: 'hazeld',
          detail: reachable
            ? `reachable at ${home.socketPath}`
            : `not reachable — run hazel apply or hazeld`,
        });

        let pidStale = false;
        if (fs.existsSync(home.pidPath)) {
          const pid = Number(fs.readFileSync(home.pidPath, 'utf8').trim());
          try {
            if (pid > 0) process.kill(pid, 0);
          } catch {
            pidStale = true;
          }
          checks.push({
            ok: !pidStale || reachable,
            name: 'pid',
            detail: pidStale
              ? `stale pid file ${home.pidPath} (process ${pid} gone)`
              : `pid ${pid}`,
          });
        } else {
          checks.push({
            ok: reachable,
            name: 'pid',
            detail: reachable ? 'daemon up (no pid file yet)' : `missing ${home.pidPath}`,
          });
        }

        checks.push({
          ok: fs.existsSync(home.home),
          name: 'HAZEL_HOME',
          detail: home.home,
        });

        const projectStore = path.join(process.cwd(), '.hazel');
        let storeWritable = false;
        try {
          fs.mkdirSync(projectStore, { recursive: true });
          const probe = path.join(projectStore, '.doctor-write');
          fs.writeFileSync(probe, 'ok');
          fs.unlinkSync(probe);
          storeWritable = true;
        } catch {
          storeWritable = false;
        }
        checks.push({
          ok: storeWritable,
          name: 'store',
          detail: storeWritable ? `writable: ${projectStore}` : `not writable: ${projectStore}`,
        });

        let gatekeeper: 'healthy' | 'missing' = 'missing';
        try {
          require.resolve('@hazeljs/agent-gatekeeper');
          gatekeeper = 'healthy';
        } catch {
          gatekeeper = 'missing';
        }
        checks.push({
          ok: true,
          name: 'gatekeeper',
          detail:
            gatekeeper === 'healthy'
              ? 'peer @hazeljs/agent-gatekeeper resolvable'
              : 'peer missing — PolicyEngine / tool requiresApproval still apply',
        });

        const masterKey = path.join(home.secretsDir, '.master');
        if (fs.existsSync(masterKey) && process.platform !== 'win32') {
          const mode = fs.statSync(masterKey).mode & 0o777;
          checks.push({
            ok: mode === 0o600,
            name: 'secrets.master',
            detail:
              mode === 0o600
                ? `${masterKey} mode 0600`
                : `${masterKey} mode ${mode.toString(8)} (expected 0600)`,
          });
        } else {
          checks.push({
            ok: true,
            name: 'secrets.master',
            detail: fs.existsSync(masterKey)
              ? masterKey
              : 'not created yet (created on first hazel secret set)',
          });
        }

        // Fail closed when daemon is unreachable — local prod bar.
        const failed = checks.filter((c) => !c.ok);
        const payload = {
          ok: reachable && failed.length === 0,
          checks,
          repair: opts.repair
            ? [
                'Start the node: hazeld   (or: hazel apply agent.yaml)',
                'Reclaim leases: hazel apply then `control recover` via running daemon',
                `Install reboot persistence: HostServiceManager with command "node $(which hazeld)"`,
                pidStale ? `Remove stale pid: rm ${home.pidPath}` : undefined,
              ].filter(Boolean)
            : undefined,
          hints: ['hazel apply agent.yaml', 'hazel inspect <agent>', 'hazel approvals', 'hazel ui'],
        };
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(payload, null, 2));
        if (!payload.ok) process.exitCode = 1;
        void opts.json;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  program
    .command('ui')
    .description('Open a thin local status UI bound to hazeld (Agents / Runs / Approvals / System)')
    .option('--port <port>', 'HTTP port', '8787')
    .action(async (opts: { port: string }) => {
      try {
        await withDaemon(async () => undefined);
        const { serveLocalStatusUi } = await import('./local-status-ui');
        const port = Number(opts.port) || 8787;
        await serveLocalStatusUi(port);
        // eslint-disable-next-line no-console
        console.log(`Hazel local status UI → http://127.0.0.1:${port}`);
        // eslint-disable-next-line no-console
        console.log('Panes: System · Agents · Runs · Approvals · Skills (via inspect)');
        // eslint-disable-next-line no-console
        console.log('Ctrl+C to stop. Full control: hazel ps · approvals · doctor');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        // eslint-disable-next-line no-console
        console.error('Meanwhile: hazel ps · hazel approvals · hazel runs · hazel doctor');
        process.exitCode = 1;
      }
    });
}
