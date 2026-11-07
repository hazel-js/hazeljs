/**
 * Memory candidate classification — advisory lifecycle label only.
 * Persistence is owned by GovernedMemoryService (phase 3).
 */

import { defineDecision, type DecisionDefinition } from '../definition';
import type { DecisionPlane } from '../service';
import type { PlaneExecutionContext, PlaneResult } from '../result';
import { createRulesPlaneProvider, type PlaneProvider } from '../providers';

export const MEMORY_CANDIDATE_ANSWERS = ['persist', 'quarantine', 'discard', 'review'] as const;
export type MemoryCandidateAnswer = (typeof MEMORY_CANDIDATE_ANSWERS)[number];

export interface MemoryCandidateContext {
  text: string;
  sourceKind: 'user' | 'tool' | 'model' | 'system';
  sourceTrust?: number;
  containsSecret?: boolean;
  grantsRoleOrPolicy?: boolean;
  isPreference?: boolean;
  isProcedure?: boolean;
  sameSourceRepeatCount?: number;
}

/** Abstain maps to quarantine in classifyMemoryCandidate. */
export function createMemoryCandidateDefinition(): DecisionDefinition<
  typeof MEMORY_CANDIDATE_ANSWERS
> {
  return defineDecision({
    id: 'memory.candidate-class',
    version: '1',
    domain: 'memory',
    description: 'Classify a memory candidate before persistence',
    answers: MEMORY_CANDIDATE_ANSWERS,
    criteria: {
      persist: 'Validated preference or fact within authorized scope',
      quarantine: 'Suspicious, secret-bearing, or tool-poisoned content',
      discard: 'Noise or ephemeral content with no durable value',
      review: 'High-impact procedure or org-wide promotion candidate',
    },
    timeoutMs: 500,
    strategy: { providers: ['memory-candidate-rules'], onFailure: 'abstain', maxRetries: 0 },
    cache: { enabled: false },
    securityCritical: true,
  });
}

export function createMemoryCandidateRulesProvider(): PlaneProvider {
  return createRulesPlaneProvider<MemoryCandidateAnswer>({
    name: 'memory-candidate-rules',
    rules: [
      {
        answer: 'quarantine',
        when: (ctx: unknown): boolean => {
          const c = ctx as MemoryCandidateContext;
          return !!(
            c.containsSecret ||
            c.grantsRoleOrPolicy ||
            /api[_-]?key|password|secret|bearer\s+[a-z0-9]/i.test(c.text) ||
            /you are now admin|grant.*role|ignore previous/i.test(c.text)
          );
        },
        summary: 'Secret or privilege-escalation content.',
      },
      {
        answer: 'review',
        when: (ctx: unknown): boolean => {
          const c = ctx as MemoryCandidateContext;
          return !!c.isProcedure;
        },
        summary: 'Procedural memory needs approval before executable.',
      },
      {
        answer: 'persist',
        when: (ctx: unknown): boolean => {
          const c = ctx as MemoryCandidateContext;
          return (
            (c.isPreference || c.sourceKind === 'user') &&
            (c.sourceTrust ?? 0.5) >= 0.4 &&
            !c.containsSecret
          );
        },
        summary: 'Authorized preference or user fact.',
      },
      {
        answer: 'discard',
        when: (ctx: unknown): boolean => {
          const c = ctx as MemoryCandidateContext;
          return c.sourceKind === 'tool' && (c.sourceTrust ?? 0) < 0.3;
        },
        summary: 'Low-trust tool noise.',
      },
    ],
    onNoMatch: { answer: 'review', summary: 'Default to human review.' },
  });
}

export interface MemoryCandidateClassification {
  result: PlaneResult<MemoryCandidateAnswer>;
  action: MemoryCandidateAnswer;
}

export async function classifyMemoryCandidate(
  plane: DecisionPlane,
  input: {
    context: MemoryCandidateContext;
    execution: PlaneExecutionContext;
    definition?: DecisionDefinition<typeof MEMORY_CANDIDATE_ANSWERS>;
  }
): Promise<MemoryCandidateClassification> {
  const definition = input.definition ?? createMemoryCandidateDefinition();
  const result = await plane.decide({
    definition,
    context: input.context,
    execution: input.execution,
  });

  let action: MemoryCandidateAnswer = 'quarantine';
  if (result.status === 'succeeded') {
    action = result.answer;
  } else if (result.status === 'abstained') {
    action = 'quarantine';
  }

  return { result: result as PlaneResult<MemoryCandidateAnswer>, action };
}
