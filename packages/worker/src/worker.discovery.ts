import { Service } from '@hazeljs/core';
import type { HazelApp } from '@hazeljs/core';
import { Container } from '@hazeljs/core';
import { getWorkerTaskMetadata } from './worker.decorator';
import type { WorkerRegistry } from './worker.registry';
import type { WorkerModuleOptions } from './worker.types';
import logger from '@hazeljs/core';

/**
 * Discovers @WorkerTask decorated classes from the DI container and
 * populates the registry. User must provide taskRegistry or taskDirectory
 * for path resolution.
 */
@Service()
export class WorkerTaskDiscovery {
  constructor(private readonly registry: WorkerRegistry) {}

  /**
   * Discover worker tasks from container and merge with module options.
   * Called during OnApplicationBootstrap.
   */
  async onApplicationBootstrap(_app: HazelApp, options: WorkerModuleOptions): Promise<void> {
    const discoveredNames = this.discoverTaskNames();

    if (discoveredNames.length > 0) {
      logger.debug(`Discovered worker tasks: ${discoveredNames.join(', ')}`);
    }

    if (options.taskRegistry && Object.keys(options.taskRegistry).length > 0) {
      this.registry.registerFromMap(options.taskRegistry, {
        timeout: options.timeout,
      });
    }

    if (options.taskDirectory && discoveredNames.length > 0) {
      this.registry.registerFromDirectory(options.taskDirectory, discoveredNames, {
        timeout: options.timeout,
      });
    }

    if (options.taskRegistry && options.taskDirectory && discoveredNames.length > 0) {
      const fromDir = discoveredNames.filter(
        (name) => !(options.taskRegistry as Record<string, string>)[name]
      );
      if (fromDir.length > 0) {
        this.registry.registerFromDirectory(options.taskDirectory, fromDir, {
          timeout: options.timeout,
        });
      }
    }
  }

  /**
   * Scan container for @WorkerTask decorated classes
   */
  private discoverTaskNames(): string[] {
    const names: string[] = [];
    const container = Container.getInstance();
    const tokens = container.getTokens();

    for (const token of tokens) {
      if (typeof token !== 'function' || !token.prototype) continue;
      try {
        const instance = container.resolve(token);
        if (!instance || typeof instance !== 'object') continue;

        const metadata = getWorkerTaskMetadata(instance);
        if (metadata?.name) {
          names.push(metadata.name);
        }
      } catch {
        // Skip request-scoped or unresolvable providers
      }
    }

    return [...new Set(names)];
  }
}
