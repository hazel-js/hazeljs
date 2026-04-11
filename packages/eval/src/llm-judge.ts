/**
 * LLM-as-judge — pluggable interface; wire to @hazeljs/ai or any HTTP API.
 */

export type JudgeScore = {
  score: number;
  reasoning?: string;
};

export type LLMJudgeFn = (prompt: string) => Promise<string>;

/**
 * Ask a judge model to score 0–1 given a rubric prompt.
 * Expects JSON in the response: `{ "score": number, "reasoning"?: string }`
 */
export async function parseJudgeScore(raw: string): Promise<JudgeScore> {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const parsed = JSON.parse(cleaned) as { score?: number; reasoning?: string };
  const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0;
  return { score, reasoning: parsed.reasoning };
}

export function buildRelevanceJudgePrompt(query: string, answer: string): string {
  return `Rate how relevant the answer is to the query on a scale of 0 to 1.
Respond with JSON only: {"score": number between 0 and 1, "reasoning": string}

Query: ${query}

Answer: ${answer}`;
}

export function buildFaithfulnessJudgePrompt(context: string, answer: string): string {
  return `Rate whether the answer is grounded in the given context (0 = hallucinated, 1 = fully supported).
Respond with JSON only: {"score": number between 0 and 1, "reasoning": string}

Context:
${context}

Answer:
${answer}`;
}
