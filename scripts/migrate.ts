import { execSync } from 'child_process';
import { join } from 'path';
import logger from '../src/core/logger';

const prismaPath = join(__dirname, '..', 'node_modules', '.bin', 'prisma');

function runCommand(command: string): void {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    logger.error(`Failed to execute command: ${command}`);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'migrate':
      logger.info('Running database migrations...');
      runCommand(`${prismaPath} migrate deploy`);
      break;

    case 'generate':
      logger.info('Generating Prisma Client...');
      runCommand(`${prismaPath} generate`);
      break;

    case 'studio':
      logger.info('Starting Prisma Studio...');
      runCommand(`${prismaPath} studio`);
      break;

    case 'reset':
      logger.info('Resetting database...');
      runCommand(`${prismaPath} migrate reset --force`);
      break;

    default:
      logger.error('Unknown command. Available commands: migrate, generate, studio, reset');
      process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Migration failed:', error);
  process.exit(1);
}); 