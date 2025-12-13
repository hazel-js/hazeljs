#!/usr/bin/env node

import { Command } from 'commander';
import { generateModule } from './commands/generate-module';
import { generateApp } from './commands/generate-app';
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
import { generateServerlessHandler } from './commands/generate-serverless-handler';
import { generateCrud } from './commands/generate-crud';
import { generateMiddleware } from './commands/generate-middleware';
import { infoCommand } from './commands/info';
import { addCommand } from './commands/add';
import { buildCommand } from './commands/build';
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
startCommand(program);
testCommand(program);

// Generate command group
const generateCommand = program
  .command('generate')
  .description('Generate HazelJS components')
  .alias('g');

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
generateWebSocketGateway(generateCommand);
generateExceptionFilter(generateCommand);
generatePipe(generateCommand);
generateRepository(generateCommand);
generateAIService(generateCommand);
generateServerlessHandler(generateCommand);

program.parse(process.argv); 