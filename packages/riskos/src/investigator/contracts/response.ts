/**
 * Investigator assistant response contracts
 */

export interface Citation {
  sourceId: string;
  excerpt?: string;
  confidence?: number;
}

export interface InvestigatorResponse {
  summary: string;
  keyFactors: string[];
  confidence: number;
  citations: Citation[];
  suggestedActions: string[];
}
