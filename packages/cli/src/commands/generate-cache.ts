import { Command } from 'commander';
import { Generator } from '../utils/generator';
import chalk from 'chalk';

const CACHE_SERVICE_TEMPLATE = `import { Injectable } from '@hazeljs/core';
import { CacheService, Cacheable, CacheEvict } from '@hazeljs/cache';

@Injectable()
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

export function generateCache(command: Command) {
  command
    .command('cache <name>')
    .description('Generate a cache service with decorators')
    .option('-p, --path <path>', 'Specify the path')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; dryRun?: boolean }) => {
      const generator = new CacheServiceGenerator();
      await generator.generate({ name, path: options.path, dryRun: options.dryRun });

      if (!options.dryRun) {
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray('  1. npm install @hazeljs/cache'));
        console.log(chalk.gray('  2. Add CacheModule to your module imports'));
        console.log(chalk.gray('  3. Configure the cache strategy (memory, redis, or multi-tier)'));
      }
    });
}
