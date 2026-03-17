import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

const DISCOVERY_TEMPLATE = `import { Service } from '@hazeljs/core';
import { ServiceRegistry, DiscoveryClient } from '@hazeljs/discovery';

@Service()
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

export async function runDiscovery(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new DiscoveryGenerator();
  const result = await generator.generate({ name, path: options.path, dryRun: options.dryRun });
  result.nextSteps = [
    'npm install @hazeljs/discovery',
    'Register this service as a provider in your module',
    'Configure your discovery backend (memory, redis, consul, or kubernetes)',
  ];
  return result;
}

export function generateDiscovery(command: Command) {
  command
    .command('discovery <name>')
    .description('Generate a service discovery setup')
    .option('-p, --path <path>', 'Specify the path')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runDiscovery(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
