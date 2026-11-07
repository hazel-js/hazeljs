import { AIModule } from '../ai.module';
import { AIEnhancedService } from '../ai-enhanced.service';
import { FakeModel } from '../testing/fake-model';
import type { ContextAssemblerPort } from '../context/context-port';
import { injectAssembledContext, lastUserQuery } from '../context/context-port';

function resetModule(): void {
  AIModule.register({});
}

describe('context-native complete()', () => {
  afterEach(() => {
    resetModule();
  });

  it('injects assembled context into a system message and returns contextMeta', async () => {
    const port: ContextAssemblerPort = {
      async assemble() {
        return {
          text: 'Tenant policy: refunds within 30 days.',
          sourcesUsed: ['cag', 'rag'],
          tokenEstimate: 12,
          plan: { sources: ['cag', 'rag'], rationale: ['policy query'] },
        };
      },
    };
    const fake = new FakeModel(['ok with context']);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);

    const res = await ai.complete(
      {
        messages: [
          { role: 'system', content: 'You are support.' },
          { role: 'user', content: 'Can I get a refund?' },
        ],
      },
      {
        provider: 'openai',
        context: port,
        contextRequest: { tenantId: 't1' },
      }
    );

    expect(res.content).toBe('ok with context');
    expect(res.contextMeta?.sourcesUsed).toEqual(['cag', 'rag']);
    expect(res.contextMeta?.tokenEstimate).toBe(12);
    expect(fake.calls).toHaveLength(1);
    const msgs = fake.calls[0].messages;
    const system = msgs.find((m) => m.role === 'system');
    expect(typeof system?.content === 'string' ? system.content : '').toContain(
      'Tenant policy: refunds within 30 days.'
    );
    expect(typeof system?.content === 'string' ? system.content : '').toContain('You are support.');
  });

  it('uses module contextService when call omits context port', async () => {
    const port: ContextAssemblerPort = {
      async assemble() {
        return { text: 'from-module', sourcesUsed: ['memory'] };
      },
    };
    AIModule.register({ contextService: port });
    const fake = new FakeModel(['ok']);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);

    const res = await ai.complete(
      { messages: [{ role: 'user', content: 'hi' }] },
      { provider: 'openai', contextRequest: { tenantId: 't1', query: 'hi' } }
    );
    expect(res.contextMeta?.sourcesUsed).toEqual(['memory']);
    const system = fake.calls[0].messages.find((m) => m.role === 'system');
    expect(typeof system?.content === 'string' ? system.content : '').toContain('from-module');
  });

  it('soft-fails when assemble throws and still completes', async () => {
    const port: ContextAssemblerPort = {
      async assemble() {
        throw new Error('contributor down');
      },
    };
    const fake = new FakeModel(['still ok']);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);

    const res = await ai.complete(
      { messages: [{ role: 'user', content: 'hi' }] },
      { provider: 'openai', context: port, contextRequest: { tenantId: 't1' } }
    );
    expect(res.content).toBe('still ok');
    expect(res.contextMeta?.softFailed).toBe(true);
    expect(res.contextMeta?.error).toContain('contributor down');
    expect(fake.calls[0].messages.some((m) => m.role === 'system')).toBe(false);
  });

  it('ChatBuilder.context passes port and request', async () => {
    const port: ContextAssemblerPort = {
      async assemble() {
        return { text: 'builder-ctx', sourcesUsed: ['kag'] };
      },
    };
    const fake = new FakeModel(['done']);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);

    const res = await ai
      .chat('question')
      .provider('openai')
      .context(port, { tenantId: 'acme' })
      .send();

    expect(res.contextMeta?.sourcesUsed).toEqual(['kag']);
    expect(fake.calls[0].messages[0].role).toBe('system');
  });

  it('injectAssembledContext prepends system when none exists', () => {
    const out = injectAssembledContext([{ role: 'user', content: 'q' }], 'facts');
    expect(out[0]).toEqual({
      role: 'system',
      content: 'Assembled context:\nfacts',
    });
    expect(out[1].role).toBe('user');
  });

  it('injectAssembledContext no-ops on blank text and flattens multipart system', () => {
    const msgs = [
      { role: 'system' as const, content: [{ type: 'text' as const, text: 'sys' }] },
      { role: 'user' as const, content: 'q' },
    ];
    expect(injectAssembledContext(msgs, '   ')).toBe(msgs);
    const merged = injectAssembledContext(msgs, 'ctx');
    expect(typeof merged[0].content === 'string' ? merged[0].content : '').toContain('sys');
    expect(typeof merged[0].content === 'string' ? merged[0].content : '').toContain('ctx');
  });

  it('lastUserQuery reads multipart user content and returns empty without user', () => {
    expect(
      lastUserQuery([
        { role: 'assistant', content: 'a' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hello' },
            { type: 'image_url', imageUrl: 'x' },
          ],
        },
      ])
    ).toContain('hello');
    expect(lastUserQuery([{ role: 'system', content: 's' }])).toBe('');
  });
});
