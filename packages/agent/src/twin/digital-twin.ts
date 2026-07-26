/**
 * Agent OS Phase 4 — Digital Twin / Canary agents
 * Shadow traffic: run primary + twin, compare outputs without affecting primary result.
 */

export interface TwinCompareResult {
  primaryOutput: string;
  twinOutput: string;
  match: boolean;
  similarity: number;
  primaryDurationMs: number;
  twinDurationMs: number;
  divergences: string[];
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  );
}

export function jaccardSimilarity(a: string, b: string): number {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export async function runDigitalTwin<T extends { response?: string; duration: number }>(opts: {
  runPrimary: () => Promise<T>;
  runTwin: () => Promise<T>;
  /** Minimum Jaccard similarity to count as match (default 0.85). */
  matchThreshold?: number;
  /** If true, twin errors are swallowed and reported as divergence. */
  swallowTwinErrors?: boolean;
}): Promise<{ primary: T; twin?: T; compare: TwinCompareResult }> {
  const threshold = opts.matchThreshold ?? 0.85;
  const primary = await opts.runPrimary();

  let twin: T | undefined;
  let twinOutput = '';
  let twinDuration = 0;
  const divergences: string[] = [];

  try {
    twin = await opts.runTwin();
    twinOutput = twin.response ?? '';
    twinDuration = twin.duration;
  } catch (e) {
    if (!opts.swallowTwinErrors) throw e;
    divergences.push(`twin_error:${(e as Error).message}`);
  }

  const primaryOutput = primary.response ?? '';
  const similarity = jaccardSimilarity(primaryOutput, twinOutput);
  if (similarity < threshold) divergences.push(`similarity_below_${threshold}`);
  if ((primary.response ?? '') !== twinOutput && similarity >= threshold) {
    divergences.push('text_diff_soft_match');
  }

  return {
    primary,
    twin,
    compare: {
      primaryOutput,
      twinOutput,
      match: similarity >= threshold && !divergences.some((d) => d.startsWith('twin_error')),
      similarity,
      primaryDurationMs: primary.duration,
      twinDurationMs: twinDuration,
      divergences,
    },
  };
}

/** Sample canary: run twin for a fraction of traffic. */
export function shouldRunCanary(sampleRate: number): boolean {
  return Math.random() < Math.max(0, Math.min(1, sampleRate));
}
