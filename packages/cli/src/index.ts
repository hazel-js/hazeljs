#!/usr/bin/env node

/**
 * HazelJS CLI — Entry point and command registration
 *
 * Architecture Overview:
 * =====================
 *
 * index.ts                 — Entry point, registers all commands with Commander
 *   ├─ commands/
 * │   ├─ generate-app.ts   — `hazel new` (full scaffolding) and `hazel g app` (skeleton)
 * │   ├─ add.ts            — `hazel add [pkg]` with --setup flag (replaces generate-setup)
 * │   ├─ info.ts           — `hazel info` (project diagnostics)
 * │   ├─ generate-simple.ts — Config-driven single-file generators (18 types)
 * │   ├─ generate-module.ts — Multi-file module generator
 * │   ├─ generate-dto.ts   — DTO pair generator
 * │   ├─ generate-crud.ts  — Full CRUD resource generator
 * │   ├─ generate-auth.ts  — Auth module with JWT guard
 * │   └─ templates.ts      — Mustache templates for all simple generators
 * └─ utils/
 *     ├─ generator.ts      — Base Generator class, shared types, string utils
 *     ├─ generator-registry.ts — Unified registry + runGenerator dispatcher
 *     └─ packages-registry.ts  — All HazelJS package metadata (single source of truth)
 *
 * Command Structure:
 * =================
 *
 * hazel new <app>           — Full interactive scaffolding (packages, git, install)
 * hazel g app <name>        — Minimal skeleton app (no install/git)
 * hazel g <type> <name>      — Unified generator for 23+ types (see --list)
 * hazel add <pkg> [--setup]  — Install HazelJS packages + optional setup file
 * hazel info                 — Project diagnostics
 *
 * Design Principles:
 * ===================
 *
 * 1. Config-driven generators: SIMPLE_GENERATORS array defines 18+ single-file generators
 * 2. Centralized package registry: HAZEL_PACKAGES drives `hazel add` and `hazel new -i`
 * 3. Machine-readable output: --json and --list --list-json for LLM tool-use
 * 4. Consistent CLI options: --path, --dry-run, --json available everywhere
 * 5. Separation of concerns: Templates live separately from logic; registry is data-driven
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { generateApp, registerGenerateApp } from './commands/generate-app';
import { generateModule } from './commands/generate-module';
import { generateDto } from './commands/generate-dto';
import { generateCrud } from './commands/generate-crud';
import { generateAuth } from './commands/generate-auth';
import { registerSimpleGenerators } from './commands/generate-simple';
import { GENERATOR_LIST } from './utils/generator-registry';
import { infoCommand } from './commands/info';
import { addCommand } from './commands/add';
import { registerEvalCommand } from './commands/eval';
import { registerBenchmarkCommand } from './commands/benchmark';
import { registerAgentCommand } from './commands/agent';
import { registerSkillgateCommand } from './commands/skillgate';
import { registerGatekeeperCommand } from './commands/gatekeeper';
import { registerStoreCommand } from './commands/store';
import { registerOrganismCommand } from './commands/organism';

// Read version from package.json to ensure consistency
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('hazel')
  .description('CLI for generating HazelJS components and applications')
  .version(packageJson.version);

// New app command
generateApp(program);

// Utility commands
infoCommand(program);
addCommand(program);
registerEvalCommand(program);
registerBenchmarkCommand(program);
registerAgentCommand(program);
registerSkillgateCommand(program);
registerGatekeeperCommand(program);
registerStoreCommand(program);
registerOrganismCommand(program);

// Generate command group (unified: hazel g <type> <name> [--path] [--dry-run] [--json], or hazel g --list)
const generateCommand = program
  .command('generate')
  .description(
    'Generate HazelJS components. Use: hazel g <type> <name> (e.g. hazel g controller users). Use --list to see all types.'
  )
  .alias('g')
  .option('--list', 'List available generator types')
  .option('--list-json', 'With --list: output list as JSON')
  .action((options: { list?: boolean; listJson?: boolean }) => {
    const outputJsonList = options.list && options.listJson;
    if (options.list) {
      if (outputJsonList) {
        console.log(JSON.stringify({ generators: GENERATOR_LIST }));
      } else {
        console.log('\nAvailable generator types:\n');
        GENERATOR_LIST.forEach((g) => {
          const nameNote = g.nameRequired ? ' <name>' : ' [name]';
          console.log(`  ${g.type}${nameNote}  ${g.description}`);
        });
        console.log('\nExample: hazel g controller users\n');
      }
    } else {
      console.log('Usage: hazel g <type> <name> [--path <path>] [--dry-run] [--json]');
      console.log('       hazel g --list         List all generator types');
      console.log('       hazel g --list --list-json   List types as JSON');
      console.log('Example: hazel g controller users\n');
    }
  });

// Skeleton app
registerGenerateApp(generateCommand);

// Complex generators (multi-file output)
generateModule(generateCommand);
generateDto(generateCommand);
generateCrud(generateCommand);
generateAuth(generateCommand);

// Simple generators (config-driven single-file output)
registerSimpleGenerators(generateCommand);

program.parse(process.argv);
