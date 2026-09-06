/**
 * Signal / outcome bridge helpers for embedding organism in product platforms.
 * Keep organism generic — callers map industry payloads into these shapes.
 */

import type {
  AgentOutcomeReport,
  EnvironmentSignal,
  SignalNeedMapping,
} from '../types/organism.types';

export type ExternalSignalLike = {
  id?: string;
  type: string;
  source: string;
  timestamp?: Date | string | number;
  severity?: number;
  confidence?: number;
  relevance?: number;
  data?: unknown;
};

/**
 * Normalize an external/product signal into an EnvironmentSignal.
 * Strips tenancy / vertical fields — those belong outside organism.
 */
export function toEnvironmentSignal(input: ExternalSignalLike): EnvironmentSignal {
  const timestamp =
    input.timestamp instanceof Date
      ? input.timestamp
      : input.timestamp != null
        ? new Date(input.timestamp)
        : new Date();

  return {
    id: input.id ?? `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    source: input.source,
    timestamp,
    data: input.data ?? {},
    severity: input.severity,
    relevance: input.relevance ?? input.confidence,
  };
}

/** Observe-ready signal when an incident is opened by an outer detection layer. */
export function toIncidentEnvironmentSignal(input: {
  incidentType: string;
  source?: string;
  severity?: number;
  data?: Record<string, unknown>;
  id?: string;
}): EnvironmentSignal {
  return toEnvironmentSignal({
    id: input.id,
    type: `incident.${input.incidentType}`,
    source: input.source ?? 'incident-engine',
    severity: input.severity,
    data: input.data ?? {},
  });
}

/**
 * Build SignalNeedMapping entries that route incident.<type> into investigation needs.
 * Domain detectors stay outside organism; this only wires need→capability after detection.
 */
export function incidentNeedMappings(
  incidentTypes: string[],
  requiredCapabilities: string[],
  opts?: { urgency?: number; confidence?: number }
): SignalNeedMapping[] {
  return incidentTypes.map((type) => ({
    signalType: `incident.${type}`,
    need: `investigate-${type}`,
    requiredCapabilities: [...requiredCapabilities],
    urgency: opts?.urgency ?? 0.85,
    confidence: opts?.confidence ?? 0.9,
  }));
}

export type OutcomeVerdictLike =
  | 'successful'
  | 'partially_successful'
  | 'neutral'
  | 'unsuccessful'
  | string;

/** Map an outer outcome evaluation into AgentOutcomeReport for utility/reputation. */
export function toAgentOutcomeReport(input: {
  verdict: OutcomeVerdictLike;
  confidence?: number;
  cost?: number;
  summary?: string;
  missionMetricUpdates?: Record<string, number>;
}): AgentOutcomeReport {
  const valueGenerated =
    input.verdict === 'successful'
      ? 1
      : input.verdict === 'partially_successful'
        ? 0.5
        : input.verdict === 'neutral'
          ? 0.2
          : 0;

  return {
    result: input.summary ?? String(input.verdict),
    metrics: {
      valueGenerated,
      confidence: input.confidence ?? 0.8,
      cost: input.cost,
      riskPenalty: input.verdict === 'unsuccessful' ? 0.5 : 0,
    },
    missionMetricUpdates: input.missionMetricUpdates,
    evidence: input.summary ? [input.summary] : undefined,
  };
}
