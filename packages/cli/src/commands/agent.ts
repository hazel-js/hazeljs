import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { listAgentTemplates, scaffoldAgentProject, type AgentTemplateId } from './agent-templates';

const DEFAULT_RUN_STORE = path.join('.hazel', 'agent-runs.json');
const DEFAULT_DURABLE_DIR = path.join('.hazel', 'runs');
const DEFAULT_TIMELINE = path.join('.hazel', 'runs', 'timeline.jsonl');

const DEFAULT_PLATFORM_STORE = path.join('.hazel', 'platform', 'resources.json');

/**
 * `hazel agent new` — scaffold Agent OS / DNA templates (G2 template unification).
 * `hazel agent install <file.dna.json>` — validate / print marketplace install plan.
 * `hazel agent run` — live execute from DNA (AOS-011).
 * `hazel agent apply|get|describe|delete|reconcile|events` — declarative platform resources (local control plane).
 * `hazel agent logs` / `doctor` — timeline + environment checks.
 * `hazel agent runs list|inspect|cancel|resume|approve` — durable store ops.
 */
export function registerAgentCommand(program: Command): void {
  const agent = program
    .command('agent')
    .description('Agent OS DNA / runtime / marketplace / platform helpers');

  agent
    .command('templates')
    .description('List Agent OS / DNA project templates')
    .option('--json', 'Print JSON')
    .action((opts: { json?: boolean }) => {
      const templates = listAgentTemplates();
      if (opts.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ ok: true, templates }, null, 2));
        return;
      }
      // eslint-disable-next-line no-console
      console.log('\nAgent OS templates (`hazel agent new <name> --template <id>`):\n');
      for (const t of templates) {
        // eslint-disable-next-line no-console
        console.log(`  ${t.id.padEnd(12)} ${t.label}`);
        // eslint-disable-next-line no-console
        console.log(`               ${t.description}\n`);
      }
    });

  agent
    .command('new')
    .description(
      'Scaffold an Agent OS / DNA project (bare | agent-os | skillgate). DNA = contract; app tools = implementation.'
    )
    .argument('<name>', 'Project directory / package name')
    .option('-t, --template <id>', 'Template: bare | agent-os | skillgate', 'agent-os')
    .option('-d, --dest <dir>', 'Parent directory', '.')
    .option('-f, --force', 'Allow non-empty destination')
    .option('--json', 'Print machine-readable result')
    .action(
      (name: string, opts: { template: string; dest: string; force?: boolean; json?: boolean }) => {
        try {
          const destDir = path.resolve(process.cwd(), opts.dest, name);
          const result = scaffoldAgentProject({
            name,
            destDir,
            template: opts.template as AgentTemplateId,
            force: opts.force,
          });
          const payload = {
            ok: true,
            action: 'agent-new',
            ...result,
            next: [
              `cd ${path.relative(process.cwd(), result.path) || '.'}`,
              result.template === 'bare'
                ? 'npx hazel agent run dna/agent.marketplace.json "hello"'
                : 'npm install && npm run dev',
              'npx hazel store publish dna/agent.marketplace.json',
            ],
          };
          // eslint-disable-next-line no-console
          console.log(
            opts.json
              ? JSON.stringify(payload, null, 2)
              : [
                  `✓ Created Agent OS project (${result.template})`,
                  `  ${result.path}`,
                  `  files: ${result.files.length}`,
                  '',
                  'Next:',
                  ...payload.next.map((l) => `  ${l}`),
                  '',
                  'Note: `hazel agent run` on DNA uses stub tools. Use the app (`npm run dev`) for real @Tool / Skillgate handlers.',
                ].join('\n')
          );
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e instanceof Error ? e.message : e);
          process.exitCode = 1;
        }
      }
    );

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
              note: 'Validate only. Use hazel store install to materialize into .hazel/agents; call runtime.installAgentPackage(path) to hot-reload',
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

  agent
    .command('run')
    .description('Execute an agent from DNA / marketplace package (live CLI run, AOS-011)')
    .argument('<file>', 'Path to .dna.json or marketplace package JSON')
    .argument('[input...]', 'User input (default: hello)')
    .option('--dir <path>', 'Durable store directory', DEFAULT_DURABLE_DIR)
    .option('--mock', 'Use offline mock LLM (no API key)')
    .option(
      '--model <model>',
      'Model id for HTTP LLM',
      process.env.HAZEL_AGENT_MODEL ?? 'gpt-4o-mini'
    )
    .option('--base-url <url>', 'OpenAI-compatible base URL', process.env.OPENAI_BASE_URL)
    .option('--api-key <key>', 'API key (default: OPENAI_API_KEY)')
    .option('--worker-id <id>', 'Worker id for run leases', `cli-${os.hostname()}`)
    .option('--max-steps <n>', 'Max agent steps', '8')
    .option('--json', 'Print full execution result JSON')
    .action(
      async (
        file: string,
        inputParts: string[],
        opts: {
          dir: string;
          mock?: boolean;
          model: string;
          baseUrl?: string;
          apiKey?: string;
          workerId: string;
          maxSteps: string;
          json?: boolean;
        }
      ) => {
        try {
          const { bootstrapRuntimeFromDna, createHttpLlmProvider, createMockLlmProvider } =
            await import('@hazeljs/agent');
          const dnaPath = path.resolve(process.cwd(), file);
          if (!fs.existsSync(dnaPath)) {
            throw new Error(`DNA file not found: ${dnaPath}`);
          }
          const input = inputParts.length ? inputParts.join(' ') : 'hello';
          const storeDir = path.resolve(process.cwd(), opts.dir);
          const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
          const llm =
            opts.mock || !apiKey
              ? createMockLlmProvider(
                  opts.mock
                    ? 'Mock reply from hazel agent run.'
                    : 'No OPENAI_API_KEY — mock reply. Pass --mock to silence this, or set a key.'
                )
              : createHttpLlmProvider({
                  apiKey,
                  baseUrl: opts.baseUrl,
                  model: opts.model,
                });

          const { runtime, dna, store, timelinePath } = bootstrapRuntimeFromDna(dnaPath, {
            llmProvider: llm,
            storeDir,
            durableSuspend: true,
            workerId: opts.workerId,
            stubTools: true,
          });

          const result = await runtime.execute(dna.name, input, {
            maxSteps: Number(opts.maxSteps) || 8,
          });
          const run = store ? await store.runRepository.get(result.executionId) : undefined;

          const summary = {
            agent: dna.name,
            executionId: result.executionId,
            state: result.state,
            response: result.response,
            runStatus: run?.status,
            storeDir,
            timelinePath,
            llm: opts.mock || !apiKey ? 'mock' : 'http',
          };
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(opts.json ? { ...summary, result, run } : summary, null, 2));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          process.exitCode = 1;
        }
      }
    );

  agent
    .command('logs')
    .description('Show AgentRun timeline JSONL (optionally filter by run id)')
    .option('--timeline <path>', 'Timeline JSONL path', DEFAULT_TIMELINE)
    .option('--run <runId>', 'Filter by execution / run id')
    .option('--agent <name>', 'Filter by agent name')
    .option('--follow', 'Tail new lines (poll)')
    .option('--interval <ms>', 'Follow poll interval', '1000')
    .action(
      async (opts: {
        timeline: string;
        run?: string;
        agent?: string;
        follow?: boolean;
        interval: string;
      }) => {
        try {
          const { FileTimelineStore } = await import('@hazeljs/agent');
          const timelinePath = path.resolve(process.cwd(), opts.timeline);
          const store = new FileTimelineStore(timelinePath);

          const print = () => {
            const steps = store.load({
              executionId: opts.run,
              agentName: opts.agent,
            });
            // eslint-disable-next-line no-console
            console.log(JSON.stringify(steps, null, 2));
          };

          if (!opts.follow) {
            print();
            return;
          }

          let lastSize = fs.existsSync(timelinePath) ? fs.statSync(timelinePath).size : 0;
          print();
          const ms = Math.max(200, Number(opts.interval) || 1000);
          // eslint-disable-next-line no-console
          console.error(`Following ${timelinePath} every ${ms}ms (Ctrl+C to stop)…`);
          setInterval(() => {
            if (!fs.existsSync(timelinePath)) return;
            const size = fs.statSync(timelinePath).size;
            if (size !== lastSize) {
              lastSize = size;
              print();
            }
          }, ms);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          process.exitCode = 1;
        }
      }
    );

  agent
    .command('doctor')
    .description('Check Agent OS CLI environment (peers, store paths, LLM key)')
    .option('--dir <path>', 'Expected durable store directory', DEFAULT_DURABLE_DIR)
    .action(async (opts: { dir: string }) => {
      try {
        const cwd = process.cwd();
        const storeDir = path.resolve(cwd, opts.dir);
        const checks: Array<{ ok: boolean; name: string; detail: string }> = [];

        checks.push({
          ok: true,
          name: 'node',
          detail: process.version,
        });

        try {
          await import('@hazeljs/agent');
          checks.push({ ok: true, name: '@hazeljs/agent', detail: 'resolvable' });
        } catch (e) {
          checks.push({
            ok: false,
            name: '@hazeljs/agent',
            detail: e instanceof Error ? e.message : String(e),
          });
        }

        const pkgPath = path.join(cwd, 'package.json');
        checks.push({
          ok: fs.existsSync(pkgPath),
          name: 'package.json',
          detail: fs.existsSync(pkgPath) ? pkgPath : 'missing in cwd',
        });

        checks.push({
          ok: true,
          name: 'durableStore',
          detail: fs.existsSync(storeDir)
            ? `exists: ${storeDir}`
            : `will be created on run: ${storeDir}`,
        });

        const key = process.env.OPENAI_API_KEY;
        checks.push({
          ok: Boolean(key),
          name: 'OPENAI_API_KEY',
          detail: key ? 'set (http LLM available)' : 'unset — use --mock for offline run',
        });

        const failed = checks.filter((c) => !c.ok);
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            {
              ok:
                failed.length === 0 || (failed.length === 1 && failed[0].name === 'OPENAI_API_KEY'),
              checks,
              hints: [
                'hazel agent run ./agent.dna.json "hello" --mock',
                'hazel agent runs list --dir .hazel/runs',
                'hazel agent logs --timeline .hazel/runs/timeline.jsonl',
              ],
            },
            null,
            2
          )
        );
        if (failed.some((c) => c.name === '@hazeljs/agent')) process.exitCode = 1;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exitCode = 1;
      }
    });

  const runs = agent.command('runs').description('Inspect durable AgentRun records (file store)');

  runs
    .command('list')
    .description('List AgentRun records from a FileAgentRunRepository JSON store')
    .option('--store <path>', 'Path to runs JSON', DEFAULT_RUN_STORE)
    .option('--dir <path>', 'Durable store directory (uses runs.json inside)')
    .option('--agent <name>', 'Filter by agent name')
    .option('--status <status>', 'Filter by status')
    .action(async (opts: { store: string; dir?: string; agent?: string; status?: string }) => {
      try {
        const { FileAgentRunRepository, AgentRunStatus, createDurableRunStore } =
          await import('@hazeljs/agent');
        const repo = opts.dir
          ? (createDurableRunStore(path.resolve(process.cwd(), opts.dir))
              .runRepository as InstanceType<typeof FileAgentRunRepository>)
          : new FileAgentRunRepository(path.resolve(process.cwd(), opts.store));
        const filter: {
          agentName?: string;
          status?: (typeof AgentRunStatus)[keyof typeof AgentRunStatus];
        } = {};
        if (opts.agent) filter.agentName = opts.agent;
        if (opts.status) {
          const values = Object.values(AgentRunStatus) as string[];
          if (!values.includes(opts.status)) {
            throw new Error(
              `Unknown status "${opts.status}". Expected one of: ${values.join(', ')}`
            );
          }
          filter.status = opts.status as (typeof AgentRunStatus)[keyof typeof AgentRunStatus];
        }
        const list = await repo.list(filter);
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            list.map((r) => ({
              id: r.id,
              agentName: r.agentName,
              status: r.status,
              leaseOwner: r.leaseOwner,
              updatedAt: r.updatedAt,
            })),
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

  runs
    .command('inspect')
    .description('Show one AgentRun by id')
    .argument('<runId>', 'AgentRun / execution id')
    .option('--store <path>', 'Path to runs JSON', DEFAULT_RUN_STORE)
    .option('--dir <path>', 'Durable store directory')
    .action(async (runId: string, opts: { store: string; dir?: string }) => {
      try {
        const { FileAgentRunRepository, createDurableRunStore } = await import('@hazeljs/agent');
        const repo = opts.dir
          ? createDurableRunStore(path.resolve(process.cwd(), opts.dir)).runRepository
          : new FileAgentRunRepository(path.resolve(process.cwd(), opts.store));
        const run = await repo.get(runId);
        if (!run) {
          // eslint-disable-next-line no-console
          console.error(`Run not found: ${runId}`);
          process.exitCode = 1;
          return;
        }
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(run, null, 2));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exitCode = 1;
      }
    });

  runs
    .command('cancel')
    .description('Mark an AgentRun CANCELLED in the file store (does not abort a live worker)')
    .argument('<runId>', 'AgentRun / execution id')
    .option('--store <path>', 'Path to runs JSON', DEFAULT_RUN_STORE)
    .option('--dir <path>', 'Durable store directory')
    .action(async (runId: string, opts: { store: string; dir?: string }) => {
      try {
        const { FileAgentRunRepository, AgentRunStatus, createDurableRunStore } =
          await import('@hazeljs/agent');
        const repo = opts.dir
          ? createDurableRunStore(path.resolve(process.cwd(), opts.dir)).runRepository
          : new FileAgentRunRepository(path.resolve(process.cwd(), opts.store));
        const run = await repo.updateStatus(runId, AgentRunStatus.CANCELLED, {
          error: { message: 'Cancelled via hazel agent runs cancel' },
        });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ id: run.id, status: run.status }, null, 2));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exitCode = 1;
      }
    });

  const resumeAction = async (
    runId: string,
    opts: { store: string; approve?: boolean; reject?: boolean; by: string; dir?: string }
  ) => {
    try {
      const approved = opts.approve !== false && !opts.reject;
      const {
        createDurableRunStore,
        FileAgentRunRepository,
        FileHumanTaskService,
        FileCheckpointService,
      } = await import('@hazeljs/agent');

      const storePath = path.resolve(process.cwd(), opts.store);
      const isDir = opts.dir || storePath.endsWith('.hazel') || !storePath.endsWith('.json');
      let humanTasks: InstanceType<typeof FileHumanTaskService>;
      let runsRepo: InstanceType<typeof FileAgentRunRepository>;

      if (opts.dir) {
        const store = createDurableRunStore(path.resolve(process.cwd(), opts.dir));
        humanTasks = store.humanTaskService as InstanceType<typeof FileHumanTaskService>;
        runsRepo = store.runRepository as InstanceType<typeof FileAgentRunRepository>;
      } else if (isDir && !storePath.endsWith('.json')) {
        const store = createDurableRunStore(storePath);
        humanTasks = store.humanTaskService as InstanceType<typeof FileHumanTaskService>;
        runsRepo = store.runRepository as InstanceType<typeof FileAgentRunRepository>;
      } else {
        const dir = path.dirname(storePath);
        runsRepo = new FileAgentRunRepository(storePath);
        humanTasks = new FileHumanTaskService(path.join(dir, 'human-tasks.json'));
        void new FileCheckpointService(path.join(dir, 'checkpoints.json'));
      }

      const run = await runsRepo.get(runId);
      if (!run) {
        // eslint-disable-next-line no-console
        console.error(`Run not found: ${runId}`);
        process.exitCode = 1;
        return;
      }

      const tasks = await humanTasks.listByRun(runId);
      const pending = tasks.find((t) => t.status === 'pending');
      if (pending) {
        await humanTasks.resolve(pending.id, approved ? 'approved' : 'rejected', opts.by);
      }

      await runsRepo.updateStatus(runId, run.status, {
        metadata: {
          ...run.metadata,
          cliDecision: {
            approved,
            by: opts.by,
            at: new Date().toISOString(),
          },
        },
      });

      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            runId,
            decision: approved ? 'approved' : 'rejected',
            by: opts.by,
            humanTaskId: pending?.id,
            note: 'Human task updated. Call runtime.approveAndResume(runId, { approved, approvedBy }) in your app to continue the agent.',
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
  };

  runs
    .command('resume')
    .description(
      'Record HITL approve/reject on file store (in-app approveAndResume still required to continue)'
    )
    .argument('<runId>', 'AgentRun / execution id')
    .option('--store <path>', 'Path to runs.json or durable store directory', DEFAULT_RUN_STORE)
    .option('--dir <path>', 'Durable store directory (runs + human-tasks + checkpoints)')
    .option('--approve', 'Approve pending human task (default)')
    .option('--reject', 'Reject pending human task')
    .option('--by <who>', 'Approver identity', 'cli')
    .action(resumeAction);

  runs
    .command('approve')
    .description('Alias for runs resume --approve')
    .argument('<runId>', 'AgentRun / execution id')
    .option('--store <path>', 'Path to runs.json or durable store directory', DEFAULT_RUN_STORE)
    .option('--dir <path>', 'Durable store directory')
    .option('--by <who>', 'Approver identity', 'cli')
    .action(async (runId: string, opts: { store: string; dir?: string; by: string }) => {
      await resumeAction(runId, { ...opts, approve: true });
    });

  agent
    .command('apply')
    .description('Apply declarative Agent OS platform resources (Definition / Deployment / Run)')
    .requiredOption('-f, --file <path>', 'Manifest file (JSON or YAML)')
    .option('--store <path>', 'Platform resource store path', DEFAULT_PLATFORM_STORE)
    .option('--registry <path>', 'Local package registry root for packageRef resolution')
    .option('--project <path>', 'Project root for .hazel/agents packageRef resolution', '.')
    .action(async (opts: { file: string; store: string; registry?: string; project: string }) => {
      try {
        const { createLocalPlatform, defaultRegistryRoot, parsePlatformDocuments } =
          await import('@hazeljs/agent');
        const text = fs.readFileSync(path.resolve(opts.file), 'utf8');
        const docs = parsePlatformDocuments(text);
        const projectRoot = path.resolve(opts.project);
        const platform = createLocalPlatform({
          storePath: path.resolve(opts.store),
          projectRoot,
          registryRoot: opts.registry ? path.resolve(opts.registry) : defaultRegistryRoot(),
        });
        const results = [];
        for (const doc of docs) {
          const result = await platform.reconciler.applyResource(doc);
          results.push({
            kind: result.resource.kind,
            name: result.resource.metadata.name,
            namespace: result.resource.metadata.namespace ?? 'default',
            generation: result.resource.metadata.generation,
            ready: result.ready,
            message: result.message,
            conditions: result.resource.status?.conditions,
            resolved: result.resource.status?.backend,
          });
        }
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ applied: results.length, results }, null, 2));
        if (results.some((r) => !r.ready)) process.exitCode = 1;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  agent
    .command('get')
    .description('List or get platform resources from the local store')
    .argument('[type]', 'Resource type (e.g. agentdefinitions, agentdeployments)')
    .argument('[name]', 'Resource name')
    .option('--store <path>', 'Platform resource store path', DEFAULT_PLATFORM_STORE)
    .option('-n, --namespace <ns>', 'Namespace filter', 'default')
    .option('--all-namespaces', 'List across namespaces')
    .option('--project <path>', 'Project root (durable run correlation)', '.')
    .option('--summary', 'Print secret-safe summaries instead of full resources')
    .action(
      async (
        type: string | undefined,
        name: string | undefined,
        opts: {
          store: string;
          namespace: string;
          allNamespaces?: boolean;
          project: string;
          summary?: boolean;
        }
      ) => {
        try {
          const { createLocalPlatform, parseResourceTypeArg, summarizeResource } =
            await import('@hazeljs/agent');
          const platform = createLocalPlatform({
            storePath: path.resolve(opts.store),
            projectRoot: path.resolve(opts.project),
            actor: 'cli',
          });
          let kind: string | undefined;
          let resourceName = name;
          if (type) {
            const parsed = parseResourceTypeArg(name ? `${type}/${name}` : type);
            kind = parsed.kind;
            resourceName = parsed.name ?? name;
            if (parsed.namespace && !opts.allNamespaces) {
              opts.namespace = parsed.namespace;
            }
          }
          if (kind && resourceName) {
            const found = platform.repo.get(kind, resourceName, opts.namespace);
            if (!found) {
              // eslint-disable-next-line no-console
              console.error(`Not found: ${opts.namespace}/${kind}/${resourceName}`);
              process.exitCode = 1;
              return;
            }
            // eslint-disable-next-line no-console
            console.log(JSON.stringify(opts.summary ? summarizeResource(found) : found, null, 2));
            return;
          }
          const items = platform.repo.list({
            kind,
            namespace: opts.allNamespaces ? undefined : opts.namespace,
          });
          // eslint-disable-next-line no-console
          console.log(
            JSON.stringify(
              {
                items: opts.summary
                  ? items.map(summarizeResource)
                  : items.map((r) => ({
                      kind: r.kind,
                      name: r.metadata.name,
                      namespace: r.metadata.namespace ?? 'default',
                      generation: r.metadata.generation,
                      ready: r.status?.conditions?.find((c) => c.type === 'Ready')?.status,
                    })),
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
      }
    );

  agent
    .command('describe')
    .description('Describe a platform resource (spec, status, conditions)')
    .argument('<resource>', 'kind/name or namespace/kind/name')
    .option('--store <path>', 'Platform resource store path', DEFAULT_PLATFORM_STORE)
    .option('--project <path>', 'Project root (re-correlate durable runs on describe)', '.')
    .option('--refresh', 'Re-reconcile before describe (refresh durable correlation)')
    .action(
      async (resource: string, opts: { store: string; project: string; refresh?: boolean }) => {
        try {
          const { createLocalPlatform, parseResourceTypeArg } = await import('@hazeljs/agent');
          const parsed = parseResourceTypeArg(resource);
          if (!parsed.name) {
            throw new Error('describe requires kind/name (e.g. agentdeployment/support)');
          }
          const platform = createLocalPlatform({
            storePath: path.resolve(opts.store),
            projectRoot: path.resolve(opts.project),
          });
          const ns = parsed.namespace ?? 'default';
          if (opts.refresh) {
            if (parsed.kind === 'AgentDeployment') {
              await platform.reconciler.reconcileDeployment(parsed.name, ns);
            } else if (parsed.kind === 'AgentRun') {
              await platform.reconciler.reconcileRun(parsed.name, ns);
            }
          }
          const found = platform.repo.get(parsed.kind, parsed.name, ns);
          if (!found) {
            // eslint-disable-next-line no-console
            console.error(`Not found: ${ns}/${parsed.kind}/${parsed.name}`);
            process.exitCode = 1;
            return;
          }
          const { summarizeResource } = await import('@hazeljs/agent');
          // eslint-disable-next-line no-console
          console.log(
            JSON.stringify(
              {
                resource: found,
                summary: summarizeResource(found),
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
      }
    );

  agent
    .command('delete')
    .description('Delete a platform resource (deployments clean up the local backend)')
    .argument('<resource>', 'kind/name or namespace/kind/name')
    .option('--store <path>', 'Platform resource store path', DEFAULT_PLATFORM_STORE)
    .action(async (resource: string, opts: { store: string }) => {
      try {
        const { createLocalPlatform, parseResourceTypeArg } = await import('@hazeljs/agent');
        const parsed = parseResourceTypeArg(resource);
        if (!parsed.name) {
          throw new Error('delete requires kind/name (e.g. agentdeployment/support)');
        }
        const platform = createLocalPlatform({
          storePath: path.resolve(opts.store),
          projectRoot: process.cwd(),
        });
        const result = await platform.reconciler.deleteResource({
          kind: parsed.kind,
          name: parsed.name,
          namespace: parsed.namespace ?? 'default',
        });
        // FileResourceRepository auto-persists; keep save() for compatibility
        platform.save();
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            {
              deleted: result.deleted,
              kind: parsed.kind,
              name: parsed.name,
              namespace: parsed.namespace ?? 'default',
              backendMessage: result.backendMessage,
            },
            null,
            2
          )
        );
        if (!result.deleted) process.exitCode = 1;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
      }
    });

  agent
    .command('reconcile')
    .description(
      'Reconcile all AgentDeployments / AgentRuns in the local platform store (control-plane loop)'
    )
    .option('--store <path>', 'Platform resource store path', DEFAULT_PLATFORM_STORE)
    .option('--project <path>', 'Project root for packageRef / durable run correlation', '.')
    .option('--registry <path>', 'Local package registry root for packageRef resolution')
    .option('-n, --namespace <ns>', 'Limit to one namespace')
    .option('--watch', 'Keep reconciling on an interval until interrupted')
    .option('--interval <seconds>', 'Watch interval in seconds (default 5)', '5')
    .action(
      async (opts: {
        store: string;
        project: string;
        registry?: string;
        namespace?: string;
        watch?: boolean;
        interval: string;
      }) => {
        try {
          const { createLocalPlatform, defaultRegistryRoot, watchLocalPlatform } =
            await import('@hazeljs/agent');
          const projectRoot = path.resolve(opts.project);
          const platform = createLocalPlatform({
            storePath: path.resolve(opts.store),
            projectRoot,
            registryRoot: opts.registry ? path.resolve(opts.registry) : defaultRegistryRoot(),
            actor: 'cli',
          });
          const namespace = opts.namespace;

          const printTick = (
            result: {
              results: Array<{
                resource: { kind: string; metadata: { name: string; namespace?: string } };
                ready: boolean;
                message?: string;
              }>;
              ready: number;
              notReady: number;
              errors: Array<{ kind: string; name: string; namespace: string; error: string }>;
            },
            tick?: number
          ) => {
            // eslint-disable-next-line no-console
            console.log(
              JSON.stringify(
                {
                  tick: tick ?? 1,
                  ready: result.ready,
                  notReady: result.notReady,
                  errors: result.errors,
                  items: result.results.map((r) => ({
                    kind: r.resource.kind,
                    name: r.resource.metadata.name,
                    namespace: r.resource.metadata.namespace ?? 'default',
                    ready: r.ready,
                    message: r.message,
                  })),
                },
                null,
                2
              )
            );
          };

          if (!opts.watch) {
            const result = await platform.reconcileAll({ namespace });
            printTick(result);
            if (result.notReady > 0 || result.errors.length > 0) process.exitCode = 1;
            return;
          }

          const seconds = Math.max(1, Number(opts.interval) || 5);
          const ac = new AbortController();
          const onSig = () => ac.abort();
          process.on('SIGINT', onSig);
          process.on('SIGTERM', onSig);
          // eslint-disable-next-line no-console
          console.error(`Watching every ${seconds}s (Ctrl+C to stop)…`);
          await watchLocalPlatform(platform, {
            namespace,
            intervalMs: seconds * 1000,
            signal: ac.signal,
            onTick: async (result, tick) => {
              printTick(result, tick);
            },
          });
          process.off('SIGINT', onSig);
          process.off('SIGTERM', onSig);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e instanceof Error ? e.message : e);
          process.exitCode = 1;
        }
      }
    );

  agent
    .command('events')
    .description('List platform control-plane events (audit log; no secrets)')
    .option('--store <path>', 'Platform resource store path', DEFAULT_PLATFORM_STORE)
    .option('--events <path>', 'Events JSONL path (default: beside store)')
    .option('--type <type>', 'Filter by event type')
    .option('--kind <kind>', 'Filter by resource kind')
    .option('--limit <n>', 'Max events (most recent)', '50')
    .action(
      async (opts: {
        store: string;
        events?: string;
        type?: string;
        kind?: string;
        limit: string;
      }) => {
        try {
          const { createLocalPlatform } = await import('@hazeljs/agent');
          const storePath = path.resolve(opts.store);
          const platform = createLocalPlatform({
            storePath,
            eventsPath: opts.events
              ? path.resolve(opts.events)
              : path.join(path.dirname(storePath), 'events.jsonl'),
            actor: 'cli',
          });
          const items = platform.events.list({
            type: opts.type as never,
            kind: opts.kind,
            limit: Number(opts.limit) || 50,
          });
          // eslint-disable-next-line no-console
          console.log(JSON.stringify({ items }, null, 2));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e instanceof Error ? e.message : e);
          process.exitCode = 1;
        }
      }
    );
}
