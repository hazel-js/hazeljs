/**
 * Agent OS Phase 3 — Agent Evolution (failure → prompt optimize → retest)
 */

export interface EvolutionFailure {
  input: string;
  output?: string;
  error?: string;
  expectedHint?: string;
}

export interface EvolutionSuggestion {
  revisedSystemPrompt: string;
  rationale: string;
  changes: string[];
}

export interface EvolutionLlm {
  complete(prompt: string): Promise<string>;
}

const FALLBACK_RATIONALE = 'Heuristic evolution without LLM — appended failure lessons to system prompt.';

/** Build an improved system prompt from failures (LLM optional). */
export async function evolveSystemPrompt(opts: {
  currentPrompt: string;
  failures: EvolutionFailure[];
  llm?: EvolutionLlm;
}): Promise<EvolutionSuggestion> {
  if (!opts.failures.length) {
    return {
      revisedSystemPrompt: opts.currentPrompt,
      rationale: 'No failures provided',
      changes: [],
    };
  }

  const lessons = opts.failures.map((f, i) => {
    const parts = [`Case ${i + 1}: input=${JSON.stringify(f.input)}`];
    if (f.output) parts.push(`output=${JSON.stringify(f.output)}`);
    if (f.error) parts.push(`error=${f.error}`);
    if (f.expectedHint) parts.push(`expected=${f.expectedHint}`);
    return parts.join('; ');
  });

  if (opts.llm) {
    const prompt = `You improve agent system prompts.
Current system prompt:
"""
${opts.currentPrompt}
"""
Recent failures:
${lessons.map((l) => `- ${l}`).join('\n')}

Return JSON only: { "revisedSystemPrompt": string, "rationale": string, "changes": string[] }`;
    const raw = await opts.llm.complete(prompt);
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as EvolutionSuggestion;
      if (parsed.revisedSystemPrompt) return parsed;
    } catch {
      // fall through
    }
  }

  const appendix = `\n\n## Lessons from recent failures\n${lessons.map((l) => `- ${l}`).join('\n')}\nAvoid repeating these mistakes.`;
  return {
    revisedSystemPrompt: `${opts.currentPrompt.trim()}${appendix}`,
    rationale: FALLBACK_RATIONALE,
    changes: lessons.map((_, i) => `Incorporate failure case ${i + 1}`),
  };
}

/** Optimize → retest loop until all cases pass or maxRounds. */
export async function runEvolutionLoop(opts: {
  systemPrompt: string;
  cases: Array<{ input: string; assert: (output: string) => boolean; expectedHint?: string }>;
  run: (systemPrompt: string, input: string) => Promise<string>;
  llm?: EvolutionLlm;
  maxRounds?: number;
}): Promise<{
  systemPrompt: string;
  rounds: number;
  passed: boolean;
  history: EvolutionSuggestion[];
}> {
  let prompt = opts.systemPrompt;
  const history: EvolutionSuggestion[] = [];
  const maxRounds = opts.maxRounds ?? 3;

  for (let round = 0; round < maxRounds; round++) {
    const failures: EvolutionFailure[] = [];
    for (const c of opts.cases) {
      try {
        const out = await opts.run(prompt, c.input);
        if (!c.assert(out)) {
          failures.push({ input: c.input, output: out, expectedHint: c.expectedHint });
        }
      } catch (e) {
        failures.push({ input: c.input, error: (e as Error).message, expectedHint: c.expectedHint });
      }
    }
    if (failures.length === 0) {
      return { systemPrompt: prompt, rounds: round, passed: true, history };
    }
    const suggestion = await evolveSystemPrompt({ currentPrompt: prompt, failures, llm: opts.llm });
    history.push(suggestion);
    prompt = suggestion.revisedSystemPrompt;
  }

  return { systemPrompt: prompt, rounds: maxRounds, passed: false, history };
}
