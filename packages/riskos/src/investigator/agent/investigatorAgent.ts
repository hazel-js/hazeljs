/**
 * Investigator assistant - stub implementation
 * Full LLM implementation in @hazeljs/agents when installed
 */

import type { InvestigatorResponse } from '../contracts/response';

export interface InvestigatorInput {
  caseId: string;
  question: string;
  tenantId?: string;
  actor?: { userId?: string; role?: string };
}

/** Stub investigator - produces structured response with "No sources available" when no citations */
export async function runInvestigatorAgent(
  input: InvestigatorInput,
): Promise<InvestigatorResponse> {
  return {
    summary: `Investigation placeholder for case ${input.caseId}. No sources available - suggest running KYC checks and risk scoring.`,
    keyFactors: ['Placeholder - no actual analysis performed'],
    confidence: 0,
    citations: [],
    suggestedActions: [
      'Run transaction timeline',
      'Check risk history',
      'Verify KYC status',
      'Build evidence pack',
    ],
  };
}

/** Format response with citation notice */
export function formatResponseWithCitations(res: InvestigatorResponse): string {
  const cit = res.citations.length > 0
    ? res.citations.map(c => `[${c.sourceId}]`).join(', ')
    : 'No sources available';
  return `${res.summary}\n\nKey factors: ${res.keyFactors.join('; ')}\n\nCitations: ${cit}\n\nSuggested: ${res.suggestedActions.join(', ')}`;
}
