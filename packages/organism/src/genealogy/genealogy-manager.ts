/**
 * Genealogy helpers — parent/child tree formatting and queries.
 */

import type { AgentGenealogy, RuntimeAgentRecord } from '../types/organism.types';
import type { OrganismRepository } from '../persistence/organism-repository';

export class GenealogyManager {
  constructor(
    private readonly repo: OrganismRepository,
    private readonly organismId: string
  ) {}

  async list(): Promise<AgentGenealogy[]> {
    return this.repo.listGenealogy(this.organismId);
  }

  async getLineage(agentId: string): Promise<AgentGenealogy[]> {
    const all = await this.list();
    const byId = new Map(all.map((g) => [g.agentId, g]));
    const chain: AgentGenealogy[] = [];
    let current = byId.get(agentId);
    while (current) {
      chain.unshift(current);
      current = current.parentAgentId ? byId.get(current.parentAgentId) : undefined;
    }
    return chain;
  }

  async countLiveChildren(parentId: string, agents: RuntimeAgentRecord[]): Promise<number> {
    const live = new Set(
      agents.filter((a) => a.status !== 'terminated' && a.status !== 'failed').map((a) => a.id)
    );
    const gene = (await this.list()).find((g) => g.agentId === parentId);
    if (!gene) return 0;
    return gene.children.filter((id) => live.has(id)).length;
  }

  /**
   * ASCII tree suitable for CLI / debug logs.
   */
  formatTree(agents: RuntimeAgentRecord[], genealogy: AgentGenealogy[]): string {
    const byId = new Map(agents.map((a) => [a.id, a]));
    const geneById = new Map(genealogy.map((g) => [g.agentId, g]));
    const roots = genealogy.filter((g) => !g.parentAgentId || !geneById.has(g.parentAgentId));

    const lines: string[] = [];
    const walk = (node: AgentGenealogy, prefix: string, isLast: boolean): void => {
      const agent = byId.get(node.agentId);
      const label = agent
        ? `${agent.name} #${agent.id} gen=${node.generation} [${agent.status}]`
        : `${node.agentId} gen=${node.generation}`;
      const branch = prefix === '' ? '' : isLast ? '└── ' : '├── ';
      lines.push(`${prefix}${branch}${label}`);
      const childPrefix = prefix === '' ? '' : prefix + (isLast ? '    ' : '│   ');
      const children = node.children
        .map((id) => geneById.get(id))
        .filter((g): g is AgentGenealogy => !!g);
      children.forEach((child, i) => {
        walk(child, childPrefix, i === children.length - 1);
      });
    };

    if (!roots.length) {
      return '(empty genealogy)';
    }
    roots.forEach((root, i) => walk(root, '', i === roots.length - 1));
    return lines.join('\n');
  }
}
