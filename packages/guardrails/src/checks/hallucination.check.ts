/**
 * Heuristic hallucination / grounding check — compares answer tokens to context.
 * For production, combine with LLM-as-judge or @hazeljs/eval.
 */

export interface HallucinationCheckResult {
  grounded: boolean;
  overlapRatio: number;
  suspiciousPhrases: string[];
}

const HEDGE_WORDS = ['might', 'maybe', 'possibly', 'could be', 'i think', "i'm not sure"];

/**
 * Returns true when answer appears supported by context (token overlap + hedge detection).
 */
export function checkHallucinationHeuristic(
  answer: string,
  context: string
): HallucinationCheckResult {
  const a = tokenize(answer);
  const c = new Set(tokenize(context));
  if (a.length === 0) {
    return { grounded: true, overlapRatio: 1, suspiciousPhrases: [] };
  }
  let hit = 0;
  for (const w of a) {
    if (c.has(w)) hit++;
  }
  const overlapRatio = hit / a.length;
  const lower = answer.toLowerCase();
  const suspiciousPhrases = HEDGE_WORDS.filter((h) => lower.includes(h));
  const grounded = overlapRatio >= 0.15 && suspiciousPhrases.length < 3;
  return { grounded, overlapRatio, suspiciousPhrases };
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}
