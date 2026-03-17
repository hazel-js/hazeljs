import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

const CACHE_SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
import { CacheService, Cacheable, CacheEvict } from '@hazeljs/cache';

@Service()
export class {{className}}CacheService {
  constructor(private readonly cacheService: CacheService) {}

  @Cacheable({ key: '{{fileName}}:all', ttl: 60 })
  async findAll() {
    // This result will be cached for 60 seconds
    return [];
  }

  @Cacheable({ key: '{{fileName}}:{{=<% %>=}}#{id}<%={{ }}=%>', ttl: 300 })
  async findOne(id: string) {
    // This result will be cached for 5 minutes
    return { id };
  }

  @CacheEvict({ key: '{{fileName}}:all' })
  async create(data: any) {
    // Creating a new item evicts the list cache
    return data;
  }

  async clearAll() {
    await this.cacheService.clear();
  }
}
`;

class CacheServiceGenerator extends Generator {
  protected suffix = 'cache';

  protected getDefaultTemplate(): string {
    return CACHE_SERVICE_TEMPLATE;
  }
}

export async function runCache(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new CacheServiceGenerator();
  const result = await generator.generate({ name, path: options.path, dryRun: options.dryRun });
  result.nextSteps = [
    'npm install @hazeljs/cache',
    'Add CacheModule to your module imports',
    'Configure the cache strategy (memory, redis, or multi-tier)',
  ];
  return result;
}

export function generateCache(command: Command) {
  command
    .command('cache <name>')
    .description('Generate a cache service with decorators')
    .option('-p, --path <path>', 'Specify the path')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runCache(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
