import type {
  DetectedNeed,
  EnvironmentSignal,
  MissionDefinition,
  SignalNeedMapping,
} from '../types/organism.types';

export interface PerceptionResult {
  accepted: boolean;
  signal: EnvironmentSignal;
  reason: string;
}

/**
 * Normalize + relevance-filter environment signals.
 */
export class PerceptionEngine {
  constructor(
    private readonly relevanceThreshold = 0.3,
    private readonly severityThreshold = 0.2
  ) {}

  normalize(
    raw: Partial<EnvironmentSignal> & Pick<EnvironmentSignal, 'type' | 'source'>
  ): EnvironmentSignal {
    return {
      id: raw.id ?? `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: raw.type,
      source: raw.source,
      timestamp: raw.timestamp ?? new Date(),
      data: raw.data ?? {},
      severity: raw.severity,
      relevance: raw.relevance,
    };
  }

  filter(signal: EnvironmentSignal, mission: MissionDefinition): PerceptionResult {
    const relevance = signal.relevance ?? this.inferRelevance(signal, mission);
    const severity = signal.severity ?? 0.5;
    const accepted = relevance >= this.relevanceThreshold || severity >= this.severityThreshold;
    return {
      accepted,
      signal: { ...signal, relevance, severity },
      reason: accepted
        ? `Accepted (relevance=${relevance.toFixed(2)}, severity=${severity.toFixed(2)})`
        : `Ignored (relevance=${relevance.toFixed(2)}, severity=${severity.toFixed(2)})`,
    };
  }

  private inferRelevance(signal: EnvironmentSignal, mission: MissionDefinition): number {
    const text = `${mission.objective} ${(mission.constraints ?? []).join(' ')}`.toLowerCase();
    const typeParts = signal.type.toLowerCase().split(/[._-]/);
    let hits = 0;
    for (const part of typeParts) {
      if (part.length > 2 && text.includes(part)) hits += 1;
    }
    if (hits === 0) return 0.4;
    return Math.min(1, 0.5 + hits * 0.15);
  }
}

/**
 * Deterministic need detector using configurable signal→need mappings.
 *
 * Domain-specific capability routing belongs in `signalNeedMappings`
 * (e.g. ecommerce refund → analytics). The unmapped fallback only
 * treats generic anomaly suffixes as needs and derives capability
 * hints from the signal type subject tokens — never from a fixed
 * industry vocabulary.
 */
export class NeedDetector {
  /** Tokens that describe change/anomaly, not a capability subject. */
  private static readonly ANOMALY_TOKENS = new Set([
    'increased',
    'decreased',
    'spike',
    'drop',
    'failure',
    'failed',
    'shortage',
    'delay',
    'delayed',
    'rate',
    'volume',
    'high',
    'low',
  ]);

  constructor(private readonly mappings: SignalNeedMapping[] = []) {}

  detect(signal: EnvironmentSignal, _mission: MissionDefinition): DetectedNeed | undefined {
    const mapping = this.mappings.find((m) => m.signalType === signal.type);
    if (!mapping) {
      if (!this.looksLikeAnomaly(signal.type)) {
        return undefined;
      }
      const need = signal.type.replace(/\./g, '-');
      return {
        need,
        reason: `Signal ${signal.type} indicates intervention may be required`,
        requiredCapabilities: this.capabilitiesFromSignalType(signal.type),
        urgency: signal.severity ?? 0.7,
        confidence: 0.6,
        signalId: signal.id,
      };
    }

    const data = signal.data as { baseline?: number; current?: number } | undefined;
    let reason = `Signal ${signal.type} mapped to need ${mapping.need}`;
    if (data?.baseline != null && data?.current != null) {
      reason = `${mapping.need}: ${signal.type} from ${data.baseline} to ${data.current}`;
    }

    return {
      need: mapping.need,
      reason,
      requiredCapabilities: [...mapping.requiredCapabilities],
      urgency: mapping.urgency ?? signal.severity ?? 0.7,
      confidence: mapping.confidence ?? 0.9,
      signalId: signal.id,
    };
  }

  private looksLikeAnomaly(signalType: string): boolean {
    return /(increased|decreased|spike|drop|failure|shortage|delay)/i.test(signalType);
  }

  /**
   * Derive capability hints from signal type subjects.
   * e.g. `orders.fulfillment.delay` → `['orders', 'fulfillment']`
   */
  private capabilitiesFromSignalType(signalType: string): string[] {
    const parts = signalType
      .toLowerCase()
      .split(/[._-]/)
      .filter((p) => p.length > 1 && !NeedDetector.ANOMALY_TOKENS.has(p));
    if (parts.length === 0) return ['general'];
    return Array.from(new Set(parts));
  }
}
