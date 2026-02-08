import { Command } from 'commander';
import { Generator } from '../utils/generator';
import chalk from 'chalk';

const DISCOVERY_TEMPLATE = `import { Injectable } from '@hazeljs/core';
import { ServiceRegistry, DiscoveryClient } from '@hazeljs/discovery';

@Injectable()
export class {{className}}DiscoveryService {
  constructor(
    private readonly registry: ServiceRegistry,
    private readonly client: DiscoveryClient,
  ) {}

  async registerService() {
    await this.registry.register({
      name: '{{fileName}}-service',
      host: 'localhost',
      port: 3000,
      metadata: {
        version: '1.0.0',
      },
    });
  }

  async discoverService(serviceName: string) {
    const instances = await this.client.getInstances(serviceName);
    return instances;
  }
}
`;

class DiscoveryGenerator extends Generator {
  protected suffix = 'discovery';

  protected getDefaultTemplate(): string {
    return DISCOVERY_TEMPLATE;
  }
}

export function generateDiscovery(command: Command) {
  command
    .command('discovery <name>')
    .description('Generate a service discovery setup')
    .option('-p, --path <path>', 'Specify the path')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; dryRun?: boolean }) => {
      const generator = new DiscoveryGenerator();
      await generator.generate({ name, path: options.path, dryRun: options.dryRun });

      if (!options.dryRun) {
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray('  1. npm install @hazeljs/discovery'));
        console.log(chalk.gray('  2. Register this service as a provider in your module'));
        console.log(chalk.gray('  3. Configure your discovery backend (memory, redis, consul, or kubernetes)'));
      }
    });
}
