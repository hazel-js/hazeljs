/**
 * Agent OS Phase 4 — Multi-agent consensus (voting / weighted)
 */

export type ConsensusStrategy = 'majority' | 'unanimous' | 'weighted' | 'first_valid';

export interface ConsensusVote {
  agentId: string;
  value: string;
  weight?: number;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface ConsensusResult {
  strategy: ConsensusStrategy;
  agreed: boolean;
  value?: string;
  votes: ConsensusVote[];
  tally: Record<string, number>;
  reason: string;
}

function normalize(v: string): string {
  return v.trim().toLowerCase();
}

export function runConsensus(
  votes: ConsensusVote[],
  strategy: ConsensusStrategy = 'majority'
): ConsensusResult {
  if (!votes.length) {
    return { strategy, agreed: false, votes, tally: {}, reason: 'No votes' };
  }

  const tally: Record<string, number> = {};
  for (const v of votes) {
    const key = normalize(v.value);
    const w = strategy === 'weighted' ? (v.weight ?? v.confidence ?? 1) : 1;
    tally[key] = (tally[key] ?? 0) + w;
  }

  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const [topValue, topScore] = ranked[0];

  if (strategy === 'first_valid') {
    const first = votes.find((v) => v.value.trim().length > 0);
    return {
      strategy,
      agreed: Boolean(first),
      value: first?.value,
      votes,
      tally,
      reason: first ? `First valid from ${first.agentId}` : 'No valid votes',
    };
  }

  if (strategy === 'unanimous') {
    const agreed = ranked.length === 1;
    return {
      strategy,
      agreed,
      value: agreed ? votes[0].value : undefined,
      votes,
      tally,
      reason: agreed ? 'Unanimous' : 'Disagreement',
    };
  }

  // majority / weighted
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  const agreed = topScore > total / 2 || (strategy === 'weighted' && topScore >= total * 0.5);
  const original = votes.find((v) => normalize(v.value) === topValue)?.value;

  return {
    strategy,
    agreed,
    value: agreed ? original : undefined,
    votes,
    tally,
    reason: agreed ? `Winner ${topValue} with score ${topScore}/${total}` : 'No majority',
  };
}

/** Collect votes by running multiple agents on the same input. */
export async function collectConsensusVotes(opts: {
  agentIds: string[];
  input: string;
  run: (agentId: string, input: string) => Promise<{ response?: string; confidence?: number }>;
  weights?: Record<string, number>;
}): Promise<ConsensusVote[]> {
  const votes: ConsensusVote[] = [];
  for (const id of opts.agentIds) {
    const res = await opts.run(id, opts.input);
    votes.push({
      agentId: id,
      value: res.response ?? '',
      weight: opts.weights?.[id],
      confidence: res.confidence,
    });
  }
  return votes;
}
