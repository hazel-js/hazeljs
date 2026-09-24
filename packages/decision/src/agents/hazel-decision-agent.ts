/**
 * HazelDecisionAgent — Agent OS native decision stages as @Agent / @Tool.
 * Stages are tools the runtime can invoke; the provider orchestrates which run.
 */

import { Agent, Tool } from '@hazeljs/agent';
import { z } from 'zod';
import type { AgentDnaDecision } from '@hazeljs/agent';
import { extractEvidence } from '../pipeline/evidence';
import { evaluateCandidates } from '../pipeline/candidates';
import { judgeCandidates } from '../pipeline/judge';
import { runCritic } from '../pipeline/critic';
import { calculateConfidence } from '../confidence/confidence-engine';
import type {
  CandidateEvaluation,
  CriticResult,
  DecisionConfidence,
  DecisionEvidence,
} from '../types';

const EvidenceInputSchema = z.object({
  state: z.unknown(),
  definition: z.unknown().optional(),
});

const CandidatesInputSchema = z.object({
  choices: z.array(z.string()).min(1),
  evidence: z.array(
    z.object({
      key: z.string(),
      value: z.unknown(),
      relevance: z.number(),
    })
  ),
  definition: z.unknown().optional(),
});

const JudgeInputSchema = z.object({
  choices: z.array(z.string()).min(1),
  candidates: z.array(
    z.object({
      candidate: z.string(),
      score: z.number(),
      supportingEvidence: z.array(z.string()),
      contradictingEvidence: z.array(z.string()).optional(),
    })
  ),
  definition: z.unknown().optional(),
});

const CriticInputSchema = z.object({
  decision: z.string(),
  score: z.number(),
  candidates: z.array(
    z.object({
      candidate: z.string(),
      score: z.number(),
      supportingEvidence: z.array(z.string()),
      contradictingEvidence: z.array(z.string()).optional(),
    })
  ),
  evidence: z.array(
    z.object({
      key: z.string(),
      value: z.unknown(),
      relevance: z.number(),
    })
  ),
  gaps: z.array(z.string()).default([]),
  definition: z.unknown().optional(),
});

const ConfidenceInputSchema = z.object({
  judgeScore: z.number(),
  candidates: z.array(
    z.object({
      candidate: z.string(),
      score: z.number(),
      supportingEvidence: z.array(z.string()),
      contradictingEvidence: z.array(z.string()).optional(),
    })
  ),
  evidence: z.array(
    z.object({
      key: z.string(),
      value: z.unknown(),
      relevance: z.number(),
    })
  ),
  requiredCount: z.number().int().nonnegative().default(0),
  critic: z
    .object({
      status: z.enum(['confirmed', 'challenged', 'inconclusive']),
      suggestedDecision: z.string().optional(),
      confidenceAdjustment: z.number().optional(),
      evidenceGaps: z.array(z.string()).optional(),
      notes: z.array(z.string()).optional(),
    })
    .optional(),
});

@Agent({
  name: 'hazel-decision-agent',
  description:
    'Native HazelJS Decision Runtime stages: evidence, candidates, judge, critic, confidence',
  version: '1.0.0',
})
export class HazelDecisionAgent {
  @Tool({
    name: 'decision_extract_evidence',
    description: 'Extract decision evidence from state using Decision DNA projections',
    schema: EvidenceInputSchema,
    readOnly: true,
  })
  extractEvidenceTool(input: z.infer<typeof EvidenceInputSchema>): {
    evidence: DecisionEvidence[];
    gaps: string[];
  } {
    return extractEvidence(input.state, input.definition as AgentDnaDecision | undefined);
  }

  @Tool({
    name: 'decision_evaluate_candidates',
    description: 'Score each allowed decision candidate from evidence',
    schema: CandidatesInputSchema,
    readOnly: true,
  })
  evaluateCandidatesTool(input: z.infer<typeof CandidatesInputSchema>): {
    candidates: CandidateEvaluation[];
  } {
    return {
      candidates: evaluateCandidates(
        input.choices,
        input.evidence as DecisionEvidence[],
        input.definition as AgentDnaDecision | undefined
      ),
    };
  }

  @Tool({
    name: 'decision_judge',
    description: 'Select the strongest allowed candidate',
    schema: JudgeInputSchema,
    readOnly: true,
  })
  judgeTool(input: z.infer<typeof JudgeInputSchema>): {
    decision: string;
    score: number;
    tied: boolean;
    needsReview: boolean;
  } {
    return judgeCandidates(
      input.choices,
      input.candidates as CandidateEvaluation[],
      input.definition as AgentDnaDecision | undefined
    );
  }

  @Tool({
    name: 'decision_critic',
    description: 'Challenge uncertain or high-risk decisions',
    schema: CriticInputSchema,
    readOnly: true,
  })
  criticTool(input: z.infer<typeof CriticInputSchema>): CriticResult {
    return runCritic({
      decision: input.decision,
      score: input.score,
      candidates: input.candidates as CandidateEvaluation[],
      evidence: input.evidence as DecisionEvidence[],
      gaps: input.gaps,
      definition: input.definition as AgentDnaDecision | undefined,
    });
  }

  @Tool({
    name: 'decision_confidence',
    description: 'Calculate heuristic confidence with source metadata',
    schema: ConfidenceInputSchema,
    readOnly: true,
  })
  confidenceTool(input: z.infer<typeof ConfidenceInputSchema>): DecisionConfidence {
    return calculateConfidence({
      judgeScore: input.judgeScore,
      candidates: input.candidates as CandidateEvaluation[],
      evidence: input.evidence as DecisionEvidence[],
      requiredCount: input.requiredCount,
      critic: input.critic as CriticResult | undefined,
    });
  }
}
