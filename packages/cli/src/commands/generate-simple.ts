/**
 * Config-driven generator factory for simple single-file generators.
 *
 * Architecture:
 *   1. Templates live in ./templates.ts (Mustache strings, one per generator type).
 *   2. SIMPLE_GENERATORS is a declarative config array — each entry maps a CLI
 *      sub-command to a template, suffix, alias, and optional next-steps.
 *   3. registerSimpleGenerators() loops over the config and registers each one
 *      as a Commander sub-command of `hazel generate`.
 *   4. runSimpleGenerator() instantiates a lightweight SimpleGenerator (extends
 *      the base Generator class) and renders the template with the user's name.
 *
 * To add a new single-file generator:
 *   1. Add a Mustache template in ./templates.ts
 *   2. Add a SimpleGeneratorConfig entry to SIMPLE_GENERATORS below
 *   — that's it; the CLI, --list, --json, and --dry-run support are automatic.
 */
import { Command } from 'commander';
import {
  Generator,
  GenerateResult,
  GenerateCLIOptions,
  printGenerateResult,
} from '../utils/generator';
import {
  CONTROLLER_TEMPLATE,
  SERVICE_TEMPLATE,
  GUARD_TEMPLATE,
  INTERCEPTOR_TEMPLATE,
  MIDDLEWARE_TEMPLATE,
  PIPE_TEMPLATE,
  EXCEPTION_FILTER_TEMPLATE,
  REPOSITORY_TEMPLATE,
  WEBSOCKET_GATEWAY_TEMPLATE,
  AI_SERVICE_TEMPLATE,
  AGENT_TEMPLATE,
  CACHE_SERVICE_TEMPLATE,
  CRON_SERVICE_TEMPLATE,
  RAG_SERVICE_TEMPLATE,
  RAG_PIPELINE_TEMPLATE,
  DISCOVERY_TEMPLATE,
  CONFIG_TEMPLATE,
  SERVERLESS_LAMBDA_TEMPLATE,
  SERVERLESS_CLOUD_FUNCTION_TEMPLATE,
} from './templates';

// ── Generator config ─────────────────────────────────────────────────────────

/**
 * Declarative configuration for a single-file generator.
 *
 * Each entry in SIMPLE_GENERATORS produces one CLI sub-command under
 * `hazel generate` (e.g. `hazel g controller <name>`).
 */
export interface SimpleGeneratorConfig {
  /** Generator type used as the sub-command name (e.g. 'controller', 'agent') */
  type: string;
  /** Human-readable description shown in `hazel g --list` and `--help` */
  description: string;
  /** File suffix before .ts — e.g. 'controller' produces `name.controller.ts` */
  suffix: string;
  /** Mustache template string (imported from ./templates.ts) */
  template: string;
  /** Short alias for the sub-command (e.g. 'c' for controller) */
  alias?: string;
  /** Default output directory if --path is not provided (defaults to 'src') */
  defaultPath?: string;
  /** Whether the generator requires a <name> argument (false for config, etc.) */
  nameRequired: boolean;
  /** Factory function returning extra Mustache data merged into the template context */
  extraData?: (name: string) => Record<string, string>;
  /** Post-generation instructions printed to the user (e.g. 'npm install ...') */
  nextSteps?: string[];
  /** Additional CLI options beyond the standard --path, --dry-run, --json */
  extraOptions?: string[];
}

export const SIMPLE_GENERATORS: SimpleGeneratorConfig[] = [
  {
    type: 'controller',
    description: 'REST controller',
    suffix: 'controller',
    template: CONTROLLER_TEMPLATE,
    alias: 'c',
    nameRequired: true,
  },
  {
    type: 'service',
    description: 'Service class',
    suffix: 'service',
    template: SERVICE_TEMPLATE,
    alias: 's',
    nameRequired: true,
  },
  {
    type: 'guard',
    description: 'Guard (e.g. auth)',
    suffix: 'guard',
    template: GUARD_TEMPLATE,
    alias: 'gu',
    nameRequired: true,
  },
  {
    type: 'interceptor',
    description: 'Interceptor',
    suffix: 'interceptor',
    template: INTERCEPTOR_TEMPLATE,
    alias: 'i',
    nameRequired: true,
  },
  {
    type: 'middleware',
    description: 'Middleware',
    suffix: 'middleware',
    template: MIDDLEWARE_TEMPLATE,
    alias: 'mw',
    defaultPath: 'src/middleware',
    nameRequired: true,
    nextSteps: ['Import the middleware in your module or apply it globally.'],
  },
  {
    type: 'pipe',
    description: 'Validation/transform pipe',
    suffix: 'pipe',
    template: PIPE_TEMPLATE,
    nameRequired: true,
  },
  {
    type: 'filter',
    description: 'Exception filter',
    suffix: 'filter',
    template: EXCEPTION_FILTER_TEMPLATE,
    alias: 'f',
    nameRequired: true,
  },
  {
    type: 'repository',
    description: 'Prisma repository',
    suffix: 'repository',
    template: REPOSITORY_TEMPLATE,
    alias: 'repo',
    nameRequired: true,
  },
  {
    type: 'gateway',
    description: 'WebSocket gateway',
    suffix: 'gateway',
    template: WEBSOCKET_GATEWAY_TEMPLATE,
    alias: 'ws',
    nameRequired: true,
  },
  {
    type: 'ai-service',
    description: 'AI service with decorators',
    suffix: 'ai-service',
    template: AI_SERVICE_TEMPLATE,
    alias: 'ai',
    nameRequired: true,
  },
  {
    type: 'agent',
    description: 'AI agent with @Agent and @Tool',
    suffix: 'agent',
    template: AGENT_TEMPLATE,
    nameRequired: true,
    extraData: (name) => ({ description: `A ${name} agent` }),
  },
  {
    type: 'cache',
    description: 'Cache service with decorators',
    suffix: 'cache',
    template: CACHE_SERVICE_TEMPLATE,
    nameRequired: true,
    nextSteps: [
      'npm install @hazeljs/cache',
      'Add CacheModule to your module imports',
      'Configure the cache strategy (memory, redis, or multi-tier)',
    ],
  },
  {
    type: 'cron',
    description: 'Cron/scheduled job service',
    suffix: 'cron',
    template: CRON_SERVICE_TEMPLATE,
    alias: 'job',
    nameRequired: true,
    nextSteps: [
      'npm install @hazeljs/cron',
      'Add CronModule to your module imports',
      'Register this service as a provider',
    ],
  },
  {
    type: 'rag',
    description: 'RAG (Retrieval-Augmented Generation) service',
    suffix: 'rag',
    template: RAG_SERVICE_TEMPLATE,
    nameRequired: true,
    nextSteps: [
      'npm install @hazeljs/rag',
      'Register this service as a provider in your module',
      'Configure your embedding provider and vector store',
    ],
  },
  {
    type: 'rag-pipeline',
    description: 'RAG pipeline service (RAGPipeline.from + memory store)',
    suffix: 'rag-pipeline',
    template: RAG_PIPELINE_TEMPLATE,
    nameRequired: true,
    nextSteps: [
      'npm install @hazeljs/rag',
      'Wire llm() to HazelAI or AIEnhancedService',
      'For production vectors, use HazelAI persistence.rag or construct RAGPipeline with your VectorStore',
    ],
  },
  {
    type: 'discovery',
    description: 'Service discovery setup',
    suffix: 'discovery',
    template: DISCOVERY_TEMPLATE,
    nameRequired: true,
    nextSteps: [
      'npm install @hazeljs/discovery',
      'Register this service as a provider in your module',
      'Configure your discovery backend (memory, redis, consul, or kubernetes)',
    ],
  },
  {
    type: 'config',
    description: 'Config module setup',
    suffix: 'config',
    template: CONFIG_TEMPLATE,
    nameRequired: false,
    nextSteps: [
      'npm install @hazeljs/config',
      'Add ConfigModule.forRoot({ envFilePath: ".env" }) to your app module imports',
      'Create a .env file in your project root',
    ],
  },
  {
    type: 'serverless',
    description: 'Serverless handler (Lambda or Cloud Function)',
    suffix: 'handler',
    template: SERVERLESS_LAMBDA_TEMPLATE,
    alias: 'sls',
    nameRequired: true,
    extraOptions: ['platform'],
  },
];

// ── Runner factory ───────────────────────────────────────────────────────────

class SimpleGenerator extends Generator {
  constructor(
    private readonly _suffix: string,
    private readonly _template: string
  ) {
    super();
    this.suffix = _suffix;
  }

  protected getDefaultTemplate(): string {
    return this._template;
  }
}

/**
 * Execute a simple generator given its config, a name, and CLI options.
 *
 * @param config  - The SimpleGeneratorConfig entry (from SIMPLE_GENERATORS)
 * @param name    - User-provided name (e.g. 'users') — used for file and class names
 * @param options - Standard CLI options (--path, --dry-run, --json, --platform)
 * @returns A GenerateResult with created file paths and optional next steps
 */
export async function runSimpleGenerator(
  config: SimpleGeneratorConfig,
  name: string,
  options: GenerateCLIOptions
): Promise<GenerateResult> {
  // Handle serverless platform option
  let template = config.template;
  if (config.type === 'serverless' && options.platform === 'cloud-function') {
    template = SERVERLESS_CLOUD_FUNCTION_TEMPLATE;
  }

  const generator = new SimpleGenerator(config.suffix, template);
  const effectiveName = config.nameRequired ? name : name || 'app';
  const result = await generator.generate({
    name: effectiveName,
    path: options.path || config.defaultPath,
    dryRun: options.dryRun,
    data: config.extraData ? config.extraData(effectiveName) : undefined,
  });

  if (config.nextSteps) {
    result.nextSteps = [...(result.nextSteps ?? []), ...config.nextSteps];
  }

  return result;
}

/**
 * Register all simple generators as sub-commands of the `hazel generate` command.
 *
 * Iterates over SIMPLE_GENERATORS and creates a Commander sub-command for each,
 * wiring up aliases, options (--path, --dry-run, --json, plus any extraOptions),
 * and the action handler that calls runSimpleGenerator.
 *
 * @param generateCommand - The Commander `generate` parent command to attach sub-commands to
 */
export function registerSimpleGenerators(generateCommand: Command): void {
  for (const config of SIMPLE_GENERATORS) {
    const cmdStr = config.nameRequired ? `${config.type} <name>` : config.type;
    const cmd = generateCommand.command(cmdStr).description(config.description);

    if (config.alias) cmd.alias(config.alias);

    cmd.option('-p, --path <path>', 'Path where the file should be generated', config.defaultPath);
    cmd.option('--dry-run', 'Preview files without writing them');
    cmd.option('--json', 'Output result as JSON');

    if (config.extraOptions?.includes('platform')) {
      cmd.option('--platform <platform>', 'Platform: lambda or cloud-function', 'lambda');
    }

    cmd.action(
      async (nameOrOptions: string | GenerateCLIOptions, maybeOptions?: GenerateCLIOptions) => {
        const name = typeof nameOrOptions === 'string' ? nameOrOptions : '';
        const opts = typeof nameOrOptions === 'string' ? maybeOptions || {} : nameOrOptions;
        const result = await runSimpleGenerator(config, name, opts as GenerateCLIOptions);
        printGenerateResult(result, { json: (opts as GenerateCLIOptions).json });
      }
    );
  }
}

/**
 * Look up a SimpleGeneratorConfig by its type name (e.g. 'controller', 'agent').
 *
 * @param type - The generator type to find
 * @returns The matching config, or undefined if no simple generator matches
 */
export function findSimpleGenerator(type: string): SimpleGeneratorConfig | undefined {
  return SIMPLE_GENERATORS.find((g) => g.type === type);
}
