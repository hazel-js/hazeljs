/**
 * Pluggable observation extraction from a conversation turn.
 * v1: deterministic rule-based heuristics (no LLM required).
 */

import { createHash } from 'crypto';
import type { TurnObservation } from './observation';
import type { GovernedMemoryType } from './types';

export interface ExtractTurnInput {
  userText: string;
  assistantText?: string;
  subjectId: string;
  sessionId?: string;
  runId?: string;
}

export interface ObservationExtractor {
  extract(input: ExtractTurnInput): Promise<TurnObservation[]> | TurnObservation[];
}

const PREFERENCE_CUES =
  /\b(prefer|preference|preferably|always|never|don't|do not|from now on|going forward|please (use|call|email|text|message)|call me|keep (it |answers? )?short|be concise|contact me via|reach me (via|at)|use email|use slack)\b/i;

const FACT_CUES =
  /\b(my name is|i am|i'm|i work|timezone is|located in|based in|my (email|phone|title|role) is)\b/i;

const PROCEDURE_CUES =
  /\b(always grant|whenever .* (do|run|execute)|procedure:|sop:|you must always)\b/i;

const SECRET_CUES = /api[_-]?key|password|secret|bearer\s+[a-z0-9]/i;

function normalizeContent(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function contentSourceId(type: GovernedMemoryType, content: string): string {
  const h = createHash('sha256')
    .update(`${type}:${content.toLowerCase()}`)
    .digest('hex')
    .slice(0, 16);
  return `obs_${type}_${h}`;
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((s) => normalizeContent(s))
    .filter((s) => s.length >= 8);
}

function isQuestion(s: string): boolean {
  return /\?$/.test(s) || /^(who|what|when|where|why|how|can you|could you|will you)\b/i.test(s);
}

/**
 * Deterministic extractor: preference / fact cues from user text.
 * Never emits procedure from free text unless explicit procedure markers are present
 * (those are left for classifiers to quarantine/review).
 */
export class RuleBasedObservationExtractor implements ObservationExtractor {
  extract(input: ExtractTurnInput): TurnObservation[] {
    const out: TurnObservation[] = [];
    const seen = new Set<string>();

    for (const sentence of splitSentences(input.userText)) {
      if (isQuestion(sentence)) continue;
      if (sentence.length < 12 || sentence.length > 280) continue;
      if (SECRET_CUES.test(sentence)) continue;

      let type: GovernedMemoryType | null = null;
      let confidence = 0.6;

      if (PROCEDURE_CUES.test(sentence)) {
        // Surface for classification (likely quarantine/review); do not auto-treat as preference.
        type = 'procedure';
        confidence = 0.5;
      } else if (PREFERENCE_CUES.test(sentence)) {
        type = 'preference';
        confidence = 0.85;
      } else if (FACT_CUES.test(sentence)) {
        type = 'fact';
        confidence = 0.75;
      }

      if (!type) continue;

      const content = normalizeContent(sentence);
      const sourceId = contentSourceId(type, content);
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);

      out.push({
        type,
        content,
        provenance: {
          sourceKind: 'user',
          actorId: input.subjectId,
          sourceId,
          runId: input.runId,
          note: input.sessionId ? `session:${input.sessionId}` : undefined,
        },
        sourceTrust: 0.9,
        extractionConfidence: confidence,
        factConfidence: type === 'fact' ? confidence : undefined,
        sourceId,
      });
    }

    return out;
  }
}
