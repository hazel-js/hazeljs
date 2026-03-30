import { GenerateResult, GenerateCLIOptions } from './generator';
import { runModule } from '../commands/generate-module';
import { runDto } from '../commands/generate-dto';
import { runCrud } from '../commands/generate-crud';
import { runAuth } from '../commands/generate-auth';
import { runApp } from '../commands/generate-app';
import { SIMPLE_GENERATORS, runSimpleGenerator, findSimpleGenerator } from '../commands/generate-simple';

export interface GeneratorMeta {
  type: string;
  description: string;
  nameRequired: boolean;
  options?: string[];
}

/** Complex generators that need their own files (multi-file output or custom logic) */
const COMPLEX_GENERATORS: GeneratorMeta[] = [
  { type: 'app', description: 'Skeleton HazelJS application (minimal template)', nameRequired: true, options: ['path'] },
  { type: 'module', description: 'Module with controller, service, DTOs', nameRequired: true },
  { type: 'dto', description: 'Create and update DTOs', nameRequired: true },
  { type: 'crud', description: 'Full CRUD resource (controller, service, module, DTOs)', nameRequired: true, options: ['route'] },
  { type: 'auth', description: 'Auth module (JWT guard, service, controller, DTOs)', nameRequired: false },
];

/** All available generator types and their metadata (for --list). */
export const GENERATOR_LIST: GeneratorMeta[] = [
  ...COMPLEX_GENERATORS,
  ...SIMPLE_GENERATORS.map((g) => ({
    type: g.type,
    description: g.description,
    nameRequired: g.nameRequired,
    options: g.extraOptions,
  })),
];

type Runner = (name: string, options: GenerateCLIOptions) => Promise<GenerateResult>;

/** Complex runners that can't be config-driven */
const COMPLEX_RUNNERS: Record<string, Runner> = {
  app: runApp,
  module: runModule,
  dto: runDto,
  crud: runCrud,
  auth: runAuth,
};

/**
 * Run a generator by type and name. Use for unified `hazel generate <type> <name>`.
 * For types that don't require a name (auth, config), pass a placeholder (e.g. 'auth').
 */
export async function runGenerator(
  type: string,
  name: string,
  options: GenerateCLIOptions
): Promise<GenerateResult> {
  // Check complex runners first
  const complexRunner = COMPLEX_RUNNERS[type];
  if (complexRunner) {
    return complexRunner(name, options);
  }

  // Check simple generators
  const simpleConfig = findSimpleGenerator(type);
  if (simpleConfig) {
    return runSimpleGenerator(simpleConfig, name, options);
  }

  return {
    ok: false,
    created: [],
    error: `Unknown generator type: "${type}". Use "hazel generate --list" to see available types.`,
  };
}

export function getGeneratorTypes(): string[] {
  return GENERATOR_LIST.map((g) => g.type);
}
