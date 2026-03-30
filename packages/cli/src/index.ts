#!/usr/bin/env node

import { Command } from 'commander';
import { generateApp, registerGenerateApp } from './commands/generate-app';
import { generateModule } from './commands/generate-module';
import { generateDto } from './commands/generate-dto';
import { generateCrud } from './commands/generate-crud';
import { generateAuth } from './commands/generate-auth';
import { registerSimpleGenerators } from './commands/generate-simple';
import { GENERATOR_LIST } from './utils/generator-registry';
import { infoCommand } from './commands/info';
import { addCommand } from './commands/add';

const program = new Command();

program
  .name('hazel')
  .description('CLI for generating HazelJS components and applications')
  .version('0.2.0');

// New app command
generateApp(program);

// Utility commands
infoCommand(program);
addCommand(program);

// Generate command group (unified: hazel g <type> <name> [--path] [--dry-run] [--json], or hazel g --list)
const generateCommand = program
  .command('generate')
  .description('Generate HazelJS components. Use: hazel g <type> <name> (e.g. hazel g controller users). Use --list to see all types.')
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
