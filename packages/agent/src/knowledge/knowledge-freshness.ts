/**
 * Agent OS — Knowledge freshness for RAG / knowledge engine results.
 */

export interface KnowledgeDocumentMeta {
  id?: string;
  content?: string;
  /** ISO date or epoch ms when the source was last updated / indexed */
  updatedAt?: string | number;
  /** Explicit expiry ISO or epoch ms */
  expiresAt?: string | number;
  /** Optional 0–1 retrieval confidence */
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeFreshnessReport {
  retrievedAt: string;
  stale: boolean;
  /** Average confidence across docs that declare it (undefined if none). */
  averageConfidence?: number;
  /** Docs considered expired or older than maxAgeMs. */
  staleDocuments: Array<{ id?: string; reason: string }>;
  /** Docs still fresh. */
  freshCount: number;
  /** Suggested action when stale. */
  recommendation: 'ok' | 're_fetch' | 'low_confidence';
  maxAgeMs?: number;
}

function toMs(value: string | number | undefined): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') return value;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : undefined;
}

function metaField(doc: KnowledgeDocumentMeta, key: string): string | number | undefined {
  const fromMeta = doc.metadata?.[key];
  if (typeof fromMeta === 'string' || typeof fromMeta === 'number') return fromMeta;
  return undefined;
}

/**
 * Assess freshness of retrieved knowledge documents.
 * Marks stale when past expiresAt, or older than maxAgeMs from updatedAt.
 */
export function assessKnowledgeFreshness(
  docs: KnowledgeDocumentMeta[],
  opts: { maxAgeMs?: number; minConfidence?: number; now?: number } = {}
): KnowledgeFreshnessReport {
  const now = opts.now ?? Date.now();
  const maxAgeMs = opts.maxAgeMs;
  const minConfidence = opts.minConfidence ?? 0;
  const staleDocuments: KnowledgeFreshnessReport['staleDocuments'] = [];
  let freshCount = 0;
  const confidences: number[] = [];

  for (const doc of docs) {
    const id = doc.id ?? (metaField(doc, 'id') as string | undefined);
    const expiresAt = toMs(doc.expiresAt ?? metaField(doc, 'expiresAt'));
    const updatedAt = toMs(
      doc.updatedAt ?? metaField(doc, 'updatedAt') ?? metaField(doc, 'indexedAt')
    );
    const confidence =
      typeof doc.confidence === 'number'
        ? doc.confidence
        : typeof metaField(doc, 'confidence') === 'number'
          ? (metaField(doc, 'confidence') as number)
          : undefined;

    if (typeof confidence === 'number') confidences.push(confidence);

    let reason: string | undefined;
    if (expiresAt != null && expiresAt < now) {
      reason = 'expired';
    } else if (maxAgeMs != null && updatedAt != null && now - updatedAt > maxAgeMs) {
      reason = `older_than_${maxAgeMs}ms`;
    } else if (typeof confidence === 'number' && confidence < minConfidence) {
      reason = `confidence_below_${minConfidence}`;
    }

    if (reason) staleDocuments.push({ id, reason });
    else freshCount += 1;
  }

  const averageConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : undefined;

  const stale = staleDocuments.length > 0;
  let recommendation: KnowledgeFreshnessReport['recommendation'] = 'ok';
  if (staleDocuments.some((d) => d.reason.startsWith('confidence')))
    recommendation = 'low_confidence';
  if (staleDocuments.some((d) => d.reason === 'expired' || d.reason.startsWith('older_than'))) {
    recommendation = 're_fetch';
  }

  return {
    retrievedAt: new Date(now).toISOString(),
    stale,
    averageConfidence,
    staleDocuments,
    freshCount,
    recommendation,
    maxAgeMs,
  };
}
