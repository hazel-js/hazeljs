import * as fs from 'fs';
import * as path from 'path';
import { ContextService, CONTEXT_EVENTS, type AssembledContext } from '@hazeljs/context';
import { createDefaultMemoryStore, MemoryCategory, MemoryService } from '@hazeljs/memory';

const kbDir = path.join(__dirname, 'kb');
const TENANT = 'desk-local';

function readKb(name: string): string {
  return fs.readFileSync(path.join(kbDir, name), 'utf8');
}

type GraphDoc = {
  orders: Record<
    string,
    {
      customerId: string;
      customer: string;
      sku: string;
      product: string;
      total: number;
      status: string;
    }
  >;
  edges: Array<{ from: string; rel: string; to: string }>;
};

function chunkFaq(faq: string): Array<{ id: string; content: string }> {
  return faq
    .split(/\n##\s+/)
    .map((block, i) => block.trim())
    .filter(Boolean)
    .map((block, i) => ({
      id: `faq-${i}`,
      content: block.startsWith('#') ? block : `## ${block}`,
    }));
}

function scorePassage(query: string, content: string): number {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  if (terms.length === 0) return 0;
  const hay = content.toLowerCase();
  let hits = 0;
  for (const t of terms) if (hay.includes(t)) hits += 1;
  return hits / terms.length;
}

let boot: Promise<{
  service: ContextService;
  memory: MemoryService;
}> | null = null;

/** Offline ContextService: CAG policy + RAG FAQ + KAG graph + Memory prefs. */
export async function getDeskContext() {
  if (!boot) {
    boot = (async () => {
      const policy = readKb('policy.md');
      const faqChunks = chunkFaq(readKb('faq.md'));
      const graph = JSON.parse(readKb('graph.json')) as GraphDoc;

      const store = createDefaultMemoryStore();
      const memory = new MemoryService(store);
      await memory.initialize();

      const service = new ContextService({
        strategy: 'auto',
        sources: ['cache', 'rag', 'knowledge', 'memory'],
        maxTokens: 1200,
        cag: {
          async getContext() {
            return {
              context: { text: policy.trim(), fingerprint: 'policy-v1' },
              hit: true,
            };
          },
        },
        rag: {
          async search(query: string, options?: { topK?: number }) {
            const topK = options?.topK ?? 3;
            return faqChunks
              .map((c) => ({ ...c, score: scorePassage(query, c.content) }))
              .filter((c) => c.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, topK)
              .map((c) => ({ id: c.id, content: c.content, score: c.score }));
          },
        },
        kag: {
          async ask(question: string) {
            const match = question.toUpperCase().match(/ORD-?\d+/);
            const id = match
              ? match[0].startsWith('ORD')
                ? match[0].replace(/^ORD(?!-)/, 'ORD-')
                : match[0]
              : 'ORD-2042';
            const normalized = id.startsWith('ORD-') ? id : `ORD-${id.replace(/\D/g, '')}`;
            const order = graph.orders[normalized];
            if (!order) {
              return {
                answer: `No graph node for ${normalized}`,
                explanation: 'entity miss',
                confidence: 0.2,
              };
            }
            const edges = graph.edges.filter((e) => e.from === normalized);
            return {
              answer: `${normalized} is owned by ${order.customer} (${order.customerId}) and contains ${order.product} [${order.sku}] — status ${order.status}, total $${order.total}.`,
              explanation: edges.map((e) => `${e.from} -[${e.rel}]-> ${e.to}`).join('; '),
              evidence: [{ orderId: normalized, ...order, edges }],
              confidence: 0.95,
            };
          },
        },
        memory: {
          async query({ userId, limit }) {
            const items = await memory.query({ userId, limit: limit ?? 20 });
            return items.map((item) => ({
              key: item.key,
              value: item.value,
              category: String(item.category),
            }));
          },
        },
      });

      service.on(CONTEXT_EVENTS.PLANNED, (payload: unknown) => {
        const p = payload as { plan?: { sources?: string[]; rationale?: string[] } };
        const sources = p.plan?.sources?.join(', ') ?? '(none)';
        const why = (p.plan?.rationale ?? []).join(' | ') || '—';
        // eslint-disable-next-line no-console
        console.log(`  [context] plan → ${sources}`);
        // eslint-disable-next-line no-console
        console.log(`  [context] why  → ${why}`);
      });

      return { service, memory };
    })();
  }
  return boot;
}

export async function assembleContext(
  query: string,
  opts?: { userId?: string; sessionId?: string }
): Promise<AssembledContext> {
  const { service } = await getDeskContext();
  return service.assemble({
    query,
    tenantId: TENANT,
    userId: opts?.userId ?? 'desk-user',
    sessionId: opts?.sessionId,
    agentId: 'context-desk',
  });
}

export async function rememberPreference(
  userId: string,
  key: string,
  value: string
): Promise<void> {
  const { memory } = await getDeskContext();
  await memory.save({
    userId,
    category: MemoryCategory.PREFERENCE,
    key,
    value,
    source: 'explicit',
    confidence: 1,
    evidence: [],
  });
}
