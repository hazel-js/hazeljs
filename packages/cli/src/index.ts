#!/usr/bin/env node

import { Command } from 'commander';
import { generateModule } from './commands/generate-module';
import { generateApp, registerGenerateApp } from './commands/generate-app';
import { generateController } from './commands/generate-controller';
import { generateService } from './commands/generate-service';
import { generateDto } from './commands/generate-dto';
import { generateGuard } from './commands/generate-guard';
import { generateInterceptor } from './commands/generate-interceptor';
import { generateWebSocketGateway } from './commands/generate-websocket-gateway';
import { generateExceptionFilter } from './commands/generate-exception-filter';
import { generatePipe } from './commands/generate-pipe';
import { generateRepository } from './commands/generate-repository';
import { generateAIService } from './commands/generate-ai-service';
import { generateAgent } from './commands/generate-agent';
import { generateServerlessHandler } from './commands/generate-serverless-handler';
import { generateCrud } from './commands/generate-crud';
import { generateMiddleware } from './commands/generate-middleware';
import { generateAuth } from './commands/generate-auth';
import { generateConfig } from './commands/generate-config';
import { generateCache } from './commands/generate-cache';
import { generateCron } from './commands/generate-cron';
import { generateRag } from './commands/generate-rag';
import { generateDiscovery } from './commands/generate-discovery';
import { generateSetup } from './commands/generate-setup';
import { GENERATOR_LIST } from './utils/generator-registry';
import { infoCommand } from './commands/info';
import { addCommand } from './commands/add';
import { buildCommand } from './commands/build';
import { pdfToAudioCommand } from './commands/pdf-to-audio';
import { startCommand } from './commands/start';
import { testCommand } from './commands/test';

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
buildCommand(program);
pdfToAudioCommand(program);
startCommand(program);
testCommand(program);

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

// Core components
generateController(generateCommand);
generateService(generateCommand);
generateModule(generateCommand);
generateDto(generateCommand);
generateGuard(generateCommand);
generateInterceptor(generateCommand);
generateMiddleware(generateCommand);

// Advanced generators
generateCrud(generateCommand);
generateAuth(generateCommand);
generateWebSocketGateway(generateCommand);
generateExceptionFilter(generateCommand);
generatePipe(generateCommand);
generateRepository(generateCommand);
generateAIService(generateCommand);
generateAgent(generateCommand);
generateServerlessHandler(generateCommand);
generateConfig(generateCommand);
generateCache(generateCommand);
generateCron(generateCommand);
generateRag(generateCommand);
generateDiscovery(generateCommand);
generateSetup(generateCommand);

program.parse(process.argv);
