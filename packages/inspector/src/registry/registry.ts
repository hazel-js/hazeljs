/**
 * HazelInspectorRegistry - Pluggable inspector plugin registration and aggregation
 */

import type { InspectorContext, InspectorEntry, HazelInspectorPlugin } from '../contracts/types';

export type { HazelInspectorPlugin };

export class HazelInspectorRegistry {
  private plugins: HazelInspectorPlugin[] = [];

  register(plugin: HazelInspectorPlugin): void {
    if (!this.plugins.some((p) => p.name === plugin.name)) {
      this.plugins.push(plugin);
    }
  }

  getPlugins(): HazelInspectorPlugin[] {
    return [...this.plugins];
  }

  async runAll(context: InspectorContext): Promise<InspectorEntry[]> {
    const results: InspectorEntry[] = [];
    const seenIds = new Set<string>();

    for (const plugin of this.plugins) {
      try {
        if (!plugin.supports(context)) {
          continue;
        }
        const entries = await plugin.inspect(context);
        const list = Array.isArray(entries) ? entries : [];
        for (const entry of list) {
          if (!seenIds.has(entry.id)) {
            seenIds.add(entry.id);
            results.push(entry);
          }
        }
      } catch (error) {
        console.error(`[HazelInspector] Plugin ${plugin.name} failed:`, error);
      }
    }

    return results;
  }
}
