/**
 * In-process registry of live OrganismHost instances.
 * Product layers (e.g. Zynli AutonomousRuntime) should use this instead of
 * maintaining a parallel Map of hosts.
 */

import type { OrganismHost } from './organism-host';

export class OrganismHostRegistry {
  private readonly hosts = new Map<string, OrganismHost>();

  get(id: string): OrganismHost | undefined {
    return this.hosts.get(id);
  }

  has(id: string): boolean {
    return this.hosts.has(id);
  }

  register(host: OrganismHost): void {
    this.hosts.set(host.id, host);
  }

  unregister(id: string): boolean {
    return this.hosts.delete(id);
  }

  list(): OrganismHost[] {
    return [...this.hosts.values()];
  }

  /**
   * Return an existing host by id, or create/register a new one via factory.
   * When `preferredId` is set and already registered, factory is not called.
   */
  async getOrCreate(
    preferredId: string | undefined,
    factory: () => Promise<OrganismHost>
  ): Promise<OrganismHost> {
    if (preferredId) {
      const existing = this.hosts.get(preferredId);
      if (existing) return existing;
    }
    const host = await factory();
    this.hosts.set(host.id, host);
    return host;
  }

  async emergencyStop(id: string, reason?: string): Promise<boolean> {
    const host = this.hosts.get(id);
    if (!host) return false;
    await host.emergencyStop(reason);
    return true;
  }

  async emergencyStopAll(reason?: string): Promise<string[]> {
    const ids: string[] = [];
    for (const host of this.hosts.values()) {
      await host.emergencyStop(reason);
      ids.push(host.id);
    }
    return ids;
  }

  clear(): void {
    this.hosts.clear();
  }

  get size(): number {
    return this.hosts.size;
  }
}
