import type { RuntimeAgentRecord } from '../types/organism.types';

/**
 * Runtime capability graph for need detection and routing.
 */
export class CapabilityRegistry {
  private byCapability = new Map<string, Set<string>>();
  private agentCaps = new Map<string, Set<string>>();

  register(agentId: string, capabilities: string[]): void {
    this.unregister(agentId);
    const set = new Set(capabilities.map((c) => c.toLowerCase()));
    this.agentCaps.set(agentId, set);
    for (const cap of set) {
      let agents = this.byCapability.get(cap);
      if (!agents) {
        agents = new Set();
        this.byCapability.set(cap, agents);
      }
      agents.add(agentId);
    }
  }

  unregister(agentId: string): void {
    const existing = this.agentCaps.get(agentId);
    if (!existing) return;
    for (const cap of existing) {
      this.byCapability.get(cap)?.delete(agentId);
    }
    this.agentCaps.delete(agentId);
  }

  find(capability: string): string[] {
    return Array.from(this.byCapability.get(capability.toLowerCase()) ?? []);
  }

  findGap(required: string[], liveAgents: RuntimeAgentRecord[]): string[] {
    const live = new Set(
      liveAgents
        .filter((a) => a.status === 'active' || a.status === 'idle')
        .flatMap((a) => a.capabilities.map((c) => c.toLowerCase()))
    );
    return required.filter((c) => !live.has(c.toLowerCase()));
  }

  findCapableAgents(required: string[], liveAgents: RuntimeAgentRecord[]): RuntimeAgentRecord[] {
    const needed = required.map((c) => c.toLowerCase());
    return liveAgents.filter((a) => {
      if (a.status !== 'active' && a.status !== 'idle') return false;
      const caps = new Set(a.capabilities.map((c) => c.toLowerCase()));
      return needed.every((n) => caps.has(n));
    });
  }

  findPartialAgents(required: string[], liveAgents: RuntimeAgentRecord[]): RuntimeAgentRecord[] {
    const needed = required.map((c) => c.toLowerCase());
    return liveAgents.filter((a) => {
      if (a.status !== 'active' && a.status !== 'idle') return false;
      const caps = new Set(a.capabilities.map((c) => c.toLowerCase()));
      const hits = needed.filter((n) => caps.has(n)).length;
      return hits > 0 && hits < needed.length;
    });
  }

  snapshot(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [cap, agents] of this.byCapability) {
      out[cap] = Array.from(agents);
    }
    return out;
  }
}
