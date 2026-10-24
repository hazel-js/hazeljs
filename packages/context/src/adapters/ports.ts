import type {
  CagPort,
  ContextContribution,
  ContextContributor,
  ContextRequest,
  KagPort,
  MemoryPort,
  RagPort,
} from '../types';

type ContributeResult = Omit<ContextContribution, 'kind' | 'latencyMs'>;

export function createCagContributor(cag: CagPort): ContextContributor {
  return {
    kind: 'cag',
    async contribute(request: ContextRequest): Promise<ContributeResult> {
      if (typeof cag.contribute === 'function') {
        const result = await cag.contribute(request);
        return { text: result.text, evidence: result.evidence, fingerprint: result.fingerprint };
      }
      const result = await cag.getContext({
        namespace: request.namespace ?? 'default',
        tenantId: request.tenantId,
        agentId: request.agentId,
      });
      return {
        text: result.context.text,
        fingerprint: result.context.fingerprint,
        evidence: [{ hit: result.hit }],
      };
    },
  };
}

export function createRagContributor(rag: RagPort, topK = 5): ContextContributor {
  return {
    kind: 'rag',
    async contribute(request: ContextRequest): Promise<ContributeResult> {
      const results = await rag.search(request.query, { topK });
      const passages = results
        .map((r, i) => {
          const body = r.content ?? r.text ?? '';
          if (!body) return '';
          const score = r.score !== undefined ? ` (score=${r.score.toFixed?.(3) ?? r.score})` : '';
          return `[${i + 1}]${score} ${body}`;
        })
        .filter(Boolean);
      return {
        text: passages.join('\n\n'),
        evidence: results.map((r) => ({ id: r.id, score: r.score })),
        confidence: results[0]?.score,
      };
    },
  };
}

export function createKagContributor(kag: KagPort): ContextContributor {
  return {
    kind: 'kag',
    async contribute(request: ContextRequest): Promise<ContributeResult> {
      if (typeof kag.contribute === 'function') {
        const result = await kag.contribute(request);
        return { text: result.text, evidence: result.evidence, fingerprint: result.fingerprint };
      }
      const result = await kag.ask(request.query, {
        explain: true,
        tenantId: request.tenantId,
        graph: request.namespace,
      });
      const text = [result.answer, result.explanation].filter(Boolean).join('\n');
      return {
        text,
        evidence: result.evidence,
        confidence: result.confidence,
      };
    },
  };
}

export function createMemoryContributor(memory: MemoryPort): ContextContributor {
  return {
    kind: 'memory',
    async contribute(request: ContextRequest): Promise<ContributeResult> {
      const parts: string[] = [];
      const evidence: unknown[] = [];

      const userId = request.userId ?? request.tenantId;
      if (memory.query) {
        const items = await memory.query({ userId, limit: 20 });
        for (const item of items) {
          const line = formatMemoryValue(item.key, item.value, item.category);
          if (line) {
            parts.push(line);
            evidence.push(item);
          }
        }
      } else if (memory.getByUserAndCategory) {
        for (const category of ['preference', 'profile', 'episodic'] as const) {
          try {
            const items = await memory.getByUserAndCategory(userId, category);
            for (const item of items) {
              const line = formatMemoryValue(item.key, item.value, category);
              if (line) {
                parts.push(line);
                evidence.push({ ...item, category });
              }
            }
          } catch {
            // category may not exist — ignore
          }
        }
      }

      if (memory.getConversationHistory && request.sessionId) {
        const history = await memory.getConversationHistory(request.sessionId, 10);
        for (const msg of history) {
          if (msg.content) {
            parts.push(`${msg.role ?? 'user'}: ${msg.content}`);
            evidence.push(msg);
          }
        }
      }

      return { text: parts.join('\n'), evidence };
    },
  };
}

function formatMemoryValue(key?: string, value?: unknown, category?: string): string {
  if (value === undefined || value === null) return '';
  const body = typeof value === 'string' ? value : JSON.stringify(value);
  const prefix = [category, key].filter(Boolean).join('/');
  return prefix ? `${prefix}: ${body}` : body;
}
