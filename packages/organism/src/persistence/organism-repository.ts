/**
 * Persistence abstractions for organism state.
 */

import type {
  AgentGenealogy,
  EnvironmentSignal,
  OrganismDecision,
  OrganismRecord,
  RuntimeAgentRecord,
} from '../types/organism.types';

export interface OrganismRepository {
  saveOrganism(record: OrganismRecord): Promise<void>;
  getOrganism(id: string): Promise<OrganismRecord | undefined>;
  listOrganisms(): Promise<OrganismRecord[]>;
  deleteOrganism(id: string): Promise<boolean>;

  saveAgent(organismId: string, agent: RuntimeAgentRecord): Promise<void>;
  getAgent(organismId: string, agentId: string): Promise<RuntimeAgentRecord | undefined>;
  listAgents(organismId: string): Promise<RuntimeAgentRecord[]>;
  deleteAgent(organismId: string, agentId: string): Promise<boolean>;

  saveGenealogy(organismId: string, genealogy: AgentGenealogy): Promise<void>;
  listGenealogy(organismId: string): Promise<AgentGenealogy[]>;

  appendSignal(organismId: string, signal: EnvironmentSignal): Promise<void>;
  listSignals(organismId: string, limit?: number): Promise<EnvironmentSignal[]>;

  appendDecision(organismId: string, decision: OrganismDecision): Promise<void>;
  listDecisions(organismId: string, limit?: number): Promise<OrganismDecision[]>;
}

export class InMemoryOrganismRepository implements OrganismRepository {
  private organisms = new Map<string, OrganismRecord>();
  private agents = new Map<string, Map<string, RuntimeAgentRecord>>();
  private genealogy = new Map<string, Map<string, AgentGenealogy>>();
  private signals = new Map<string, EnvironmentSignal[]>();
  private decisions = new Map<string, OrganismDecision[]>();

  async saveOrganism(record: OrganismRecord): Promise<void> {
    this.organisms.set(record.id, { ...record, updatedAt: new Date() });
    if (!this.agents.has(record.id)) this.agents.set(record.id, new Map());
    if (!this.genealogy.has(record.id)) this.genealogy.set(record.id, new Map());
    if (!this.signals.has(record.id)) this.signals.set(record.id, []);
    if (!this.decisions.has(record.id)) this.decisions.set(record.id, []);
  }

  async getOrganism(id: string): Promise<OrganismRecord | undefined> {
    const record = this.organisms.get(id);
    return record ? { ...record } : undefined;
  }

  async listOrganisms(): Promise<OrganismRecord[]> {
    return Array.from(this.organisms.values()).map((r) => ({ ...r }));
  }

  async deleteOrganism(id: string): Promise<boolean> {
    this.agents.delete(id);
    this.genealogy.delete(id);
    this.signals.delete(id);
    this.decisions.delete(id);
    return this.organisms.delete(id);
  }

  async saveAgent(organismId: string, agent: RuntimeAgentRecord): Promise<void> {
    let map = this.agents.get(organismId);
    if (!map) {
      map = new Map();
      this.agents.set(organismId, map);
    }
    map.set(agent.id, { ...agent });
  }

  async getAgent(organismId: string, agentId: string): Promise<RuntimeAgentRecord | undefined> {
    const agent = this.agents.get(organismId)?.get(agentId);
    return agent ? { ...agent } : undefined;
  }

  async listAgents(organismId: string): Promise<RuntimeAgentRecord[]> {
    const map = this.agents.get(organismId);
    if (!map) return [];
    return Array.from(map.values()).map((a) => ({ ...a }));
  }

  async deleteAgent(organismId: string, agentId: string): Promise<boolean> {
    return this.agents.get(organismId)?.delete(agentId) ?? false;
  }

  async saveGenealogy(organismId: string, genealogy: AgentGenealogy): Promise<void> {
    let map = this.genealogy.get(organismId);
    if (!map) {
      map = new Map();
      this.genealogy.set(organismId, map);
    }
    map.set(genealogy.agentId, {
      ...genealogy,
      children: [...genealogy.children],
    });
  }

  async listGenealogy(organismId: string): Promise<AgentGenealogy[]> {
    const map = this.genealogy.get(organismId);
    if (!map) return [];
    return Array.from(map.values()).map((g) => ({
      ...g,
      children: [...g.children],
    }));
  }

  async appendSignal(organismId: string, signal: EnvironmentSignal): Promise<void> {
    const list = this.signals.get(organismId) ?? [];
    list.push({ ...signal });
    if (list.length > 200) list.splice(0, list.length - 200);
    this.signals.set(organismId, list);
  }

  async listSignals(organismId: string, limit = 50): Promise<EnvironmentSignal[]> {
    const list = this.signals.get(organismId) ?? [];
    return list.slice(-limit).map((s) => ({ ...s }));
  }

  async appendDecision(organismId: string, decision: OrganismDecision): Promise<void> {
    const list = this.decisions.get(organismId) ?? [];
    list.push({ ...decision });
    if (list.length > 200) list.splice(0, list.length - 200);
    this.decisions.set(organismId, list);
  }

  async listDecisions(organismId: string, limit = 50): Promise<OrganismDecision[]> {
    const list = this.decisions.get(organismId) ?? [];
    return list.slice(-limit).map((d) => ({ ...d }));
  }
}
