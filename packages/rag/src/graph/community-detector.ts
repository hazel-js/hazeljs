/**
 * CommunityDetector
 *
 * Detects communities (clusters of closely-related entities) in the knowledge
 * graph using the **Label Propagation Algorithm (LPA)**.
 *
 * Why LPA?
 *  - O(V + E) per iteration → scales well to thousands of entities
 *  - No parameters to tune (unlike Louvain's resolution parameter)
 *  - Converges in ~5–10 iterations for most real-world graphs
 *
 * Algorithm:
 *  1. Assign each entity its own unique community label.
 *  2. Shuffle entity iteration order (breaks symmetry for better convergence).
 *  3. Each entity adopts the most frequent label among its neighbours,
 *     weighted by relationship strength.
 *  4. Repeat until labels stabilise or max iterations reached.
 *  5. Groups entities that share the same label into communities.
 *
 * Large-community splitting:
 *  If a community exceeds `maxCommunitySize`, it is recursively split by
 *  running LPA on the sub-graph of its members only.
 */

import type { GraphCommunity } from './graph.types';
import type { GraphStore } from './knowledge-graph';

export interface CommunityDetectorConfig {
  maxIterations?: number;
  maxCommunitySize?: number;
}

export class CommunityDetector {
  private readonly maxIterations: number;
  private readonly maxCommunitySize: number;

  constructor(config: CommunityDetectorConfig = {}) {
    this.maxIterations = config.maxIterations ?? 10;
    this.maxCommunitySize = config.maxCommunitySize ?? 15;
  }

  /**
   * Run community detection on the full graph.
   * Returns a flat list of GraphCommunity objects (level 0 = leaf communities).
   */
  detect(graph: GraphStore): GraphCommunity[] {
    const entityIds = [...graph.entities.keys()];
    if (entityIds.length === 0) return [];

    // Build weight map: entityId → [{ neighbourId, weight }]
    const weightedAdj = this.buildWeightedAdjacency(graph);

    const labels = this.runLPA(entityIds, weightedAdj);
    const rawCommunities = this.groupByLabel(labels);

    // Split oversized communities
    const finalCommunities = this.splitOversized(rawCommunities, graph, 0);

    return finalCommunities.map((memberIds, idx) => ({
      id: `community_${idx}`,
      entityIds: memberIds,
      level: 0,
    }));
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildWeightedAdjacency(
    graph: GraphStore
  ): Map<string, Array<{ id: string; weight: number }>> {
    const adj = new Map<string, Array<{ id: string; weight: number }>>();

    for (const entityId of graph.entities.keys()) {
      adj.set(entityId, []);
    }

    for (const rel of graph.relationships.values()) {
      const srcList = adj.get(rel.sourceId) ?? [];
      const tgtList = adj.get(rel.targetId) ?? [];
      srcList.push({ id: rel.targetId, weight: rel.weight });
      tgtList.push({ id: rel.sourceId, weight: rel.weight });
      adj.set(rel.sourceId, srcList);
      adj.set(rel.targetId, tgtList);
    }

    return adj;
  }

  private runLPA(
    entityIds: string[],
    adj: Map<string, Array<{ id: string; weight: number }>>
  ): Map<string, string> {
    // Initialise: each entity is its own community
    const labels = new Map<string, string>();
    for (const id of entityIds) labels.set(id, id);

    for (let iter = 0; iter < this.maxIterations; iter++) {
      const order = this.shuffle([...entityIds]);
      let changed = false;

      for (const entityId of order) {
        const neighbours = adj.get(entityId) ?? [];
        if (neighbours.length === 0) continue;

        // Tally label weights from neighbours
        const labelWeights = new Map<string, number>();
        for (const { id, weight } of neighbours) {
          const neighbourLabel = labels.get(id)!;
          labelWeights.set(neighbourLabel, (labelWeights.get(neighbourLabel) ?? 0) + weight);
        }

        // Choose the label with the highest total weight
        let bestLabel = labels.get(entityId)!;
        let bestWeight = 0;

        for (const [label, weight] of labelWeights.entries()) {
          if (weight > bestWeight) {
            bestWeight = weight;
            bestLabel = label;
          }
        }

        if (bestLabel !== labels.get(entityId)) {
          labels.set(entityId, bestLabel);
          changed = true;
        }
      }

      if (!changed) break;
    }

    return labels;
  }

  private groupByLabel(labels: Map<string, string>): string[][] {
    const groups = new Map<string, string[]>();
    for (const [entityId, label] of labels.entries()) {
      const group = groups.get(label) ?? [];
      group.push(entityId);
      groups.set(label, group);
    }
    return [...groups.values()];
  }

  private splitOversized(communities: string[][], graph: GraphStore, level: number): string[][] {
    const result: string[][] = [];

    for (const community of communities) {
      if (community.length <= this.maxCommunitySize || level >= 3) {
        result.push(community);
        continue;
      }

      // Build sub-graph adjacency for just this community's members
      const memberSet = new Set(community);
      const subAdj = new Map<string, Array<{ id: string; weight: number }>>();
      for (const id of community) subAdj.set(id, []);

      for (const rel of graph.relationships.values()) {
        if (!memberSet.has(rel.sourceId) || !memberSet.has(rel.targetId)) continue;
        subAdj.get(rel.sourceId)!.push({ id: rel.targetId, weight: rel.weight });
        subAdj.get(rel.targetId)!.push({ id: rel.sourceId, weight: rel.weight });
      }

      const subLabels = this.runLPA(community, subAdj);
      const subCommunities = this.groupByLabel(subLabels);

      // Only split if we actually produced smaller groups
      if (subCommunities.length > 1) {
        result.push(...this.splitOversized(subCommunities, graph, level + 1));
      } else {
        result.push(community);
      }
    }

    return result;
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
