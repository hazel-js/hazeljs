import { ContextService } from '../context.service';
import { ContextPlanner } from '../planner/context-planner';
import { ContextAssembler, estimateTokens } from '../assembly/context-assembler';
import { ContextErrorCode } from '../errors/context.error';
import { CONTEXT_EVENTS } from '../types';
import type { ContextContributor } from '../types';

function stub(kind: ContextContributor['kind'], text: string): ContextContributor {
  return {
    kind,
    async contribute() {
      return { text };
    },
  };
}

describe('ContextPlanner', () => {
  it('selects kag for causal questions', () => {
    const planner = new ContextPlanner({
      strategy: 'auto',
      available: ['cag', 'rag', 'kag', 'memory'],
      sources: ['cache', 'rag', 'knowledge', 'memory'],
    });
    const plan = planner.plan({
      query: 'Why is this merchant related to that refund?',
      tenantId: 't1',
    });
    expect(plan.sources).toContain('kag');
    expect(plan.rationale.some((r) => r.includes('kag'))).toBe(true);
  });

  it('selects cag for policy questions', () => {
    const planner = new ContextPlanner({
      strategy: 'auto',
      available: ['cag', 'rag'],
    });
    const plan = planner.plan({
      query: 'What is the return policy?',
      tenantId: 't1',
    });
    expect(plan.sources).toContain('cag');
  });

  it('explicit uses allow-list only', () => {
    const planner = new ContextPlanner({
      strategy: 'explicit',
      sources: ['rag'],
      available: ['cag', 'rag', 'kag'],
    });
    const plan = planner.plan({ query: 'anything', tenantId: 't1' });
    expect(plan.sources).toEqual(['rag']);
  });
});

describe('ContextAssembler', () => {
  it('formats labeled blocks and respects token budget', () => {
    const assembler = new ContextAssembler({ maxTokens: 40 });
    const result = assembler.assemble({ sources: ['cag', 'rag'], rationale: [] }, [
      { kind: 'cag', text: 'short policy' },
      { kind: 'rag', text: 'x'.repeat(400) },
    ]);
    expect(result.text).toContain('[Cached context]');
    expect(result.sourcesUsed).toContain('cag');
    expect(result.tokenEstimate).toBeLessThanOrEqual(estimateTokens(result.text) + 1);
  });
});

describe('ContextService', () => {
  it('assembles auto plan from contributors', async () => {
    const service = new ContextService({
      strategy: 'auto',
      sources: ['cache', 'rag', 'knowledge', 'memory'],
      contributors: [
        stub('cag', 'Return within 30 days.'),
        stub('kag', 'merchant -[HAS_REFUND]-> refund'),
        stub('rag', 'Doc passage about returns.'),
        stub('memory', 'preference: exclude VAT'),
      ],
    });

    const events: string[] = [];
    service.on(CONTEXT_EVENTS.PLANNED, () => events.push('planned'));
    service.on(CONTEXT_EVENTS.ASSEMBLED, () => events.push('assembled'));

    const result = await service.assemble({
      query: 'Why was my refund related to the return policy I preferred?',
      tenantId: 'merchant-123',
      userId: 'u1',
    });

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.sourcesUsed.length).toBeGreaterThan(0);
    expect(events).toEqual(['planned', 'assembled']);
  });

  it('wraps duck-typed ports', async () => {
    const service = new ContextService({
      strategy: 'all',
      sources: ['cache', 'rag', 'knowledge', 'memory'],
      cag: {
        async getContext() {
          return { context: { text: 'cached', fingerprint: 'abc' }, hit: true };
        },
      },
      rag: {
        async search() {
          return [{ content: 'passage', score: 0.9, id: 'd1' }];
        },
      },
      kag: {
        async ask() {
          return { answer: 'because X', explanation: 'a->b', confidence: 0.9 };
        },
      },
      memory: {
        async query() {
          return [{ key: 'vat', value: 'exclude', category: 'preference' }];
        },
      },
    });

    const result = await service.assemble({
      query: 'explain everything',
      tenantId: 't1',
      userId: 'u1',
    });
    expect(result.sourcesUsed).toEqual(expect.arrayContaining(['cag', 'rag', 'kag', 'memory']));
    expect(result.text).toContain('cached');
    expect(result.text).toContain('passage');
  });

  it('requires tenant and contributors', async () => {
    const empty = new ContextService({});
    await expect(empty.assemble({ query: 'x', tenantId: 't' })).rejects.toMatchObject({
      code: ContextErrorCode.NO_CONTRIBUTORS,
    });

    const service = new ContextService({ contributors: [stub('rag', 'x')] });
    await expect(service.assemble({ query: 'x', tenantId: '' })).rejects.toMatchObject({
      code: ContextErrorCode.TENANT_REQUIRED,
    });
  });

  it('soft-fails a broken contributor', async () => {
    const service = new ContextService({
      strategy: 'explicit',
      sources: ['rag', 'cag'],
      contributors: [
        {
          kind: 'rag',
          async contribute() {
            throw new Error('rag down');
          },
        },
        stub('cag', 'still here'),
      ],
    });
    const result = await service.assemble({ query: 'q', tenantId: 't' });
    expect(result.sourcesUsed).toEqual(['cag']);
    expect(result.text).toContain('still here');
  });
});
