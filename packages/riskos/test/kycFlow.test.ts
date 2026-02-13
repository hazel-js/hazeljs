/**
 * KYC flow tests - validate step fails with Ajv errors
 */

import { KycEngine, MemoryKycStore, MockHttpProvider, nextChatTurn } from '../src';

describe('KYC Flow', () => {
  it('validate step fails with Ajv errors', async () => {
    const store = new MemoryKycStore();
    const engine = new KycEngine(store, {});

    const session = await engine.createSession();
    await engine.answer(session.id, 'email', 'not-an-email');

    const result = await engine.validate(session.id, {
      from: 'answers',
      schema: {
        type: 'object',
        properties: { email: { type: 'string', format: 'email' } },
        required: ['email'],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('runs full flow with mock provider', async () => {
    const store = new MemoryKycStore();
    const providers = {
      mock: new MockHttpProvider('mock', { mockResponse: { ok: true } }),
    };
    const engine = new KycEngine(store, providers);

    const session = await engine.createSession('tenant-1');
    await engine.answer(session.id, 'email', 'user@test.com');

    await engine.runStep(session.id, {
      type: 'apiCall',
      config: {
        provider: 'mock',
        operation: { method: 'GET', path: '/' },
        storeAt: 'result',
      },
    });

    const updated = await engine.getSession(session.id);
    expect(updated?.raw?.result).toEqual({ ok: true });
  });

  it('apiCall with headers and query', async () => {
    const store = new MemoryKycStore();
    const mockProvider = new MockHttpProvider('mock', { mockResponse: { done: true } });
    const engine = new KycEngine(store, { mock: mockProvider });
    const session = await engine.createSession();
    await engine.answer(session.id, 'token', 'secret');

    await engine.runStep(session.id, {
      type: 'apiCall',
      config: {
        provider: 'mock',
        operation: {
          method: 'GET',
          path: '/api',
          headers: { 'X-Token': '{{answers.token}}' },
          query: { q: '{{answers.token}}' },
        },
        storeAt: 'result',
      },
    });

    const updated = await engine.getSession(session.id);
    expect(updated?.raw?.result).toEqual({ done: true });
  });

  it('apiCall uses pathResponses when path matches', async () => {
    const store = new MemoryKycStore();
    const mockProvider = new MockHttpProvider('mock', {
      pathResponses: { '/custom': { custom: true } },
      mockResponse: { default: true },
    });
    const engine = new KycEngine(store, { mock: mockProvider });
    const session = await engine.createSession();

    await engine.runStep(session.id, {
      type: 'apiCall',
      config: { provider: 'mock', operation: { method: 'GET', path: '/custom' }, storeAt: 'custom' },
    });

    const updated = await engine.getSession(session.id);
    expect(updated?.raw?.custom).toEqual({ custom: true });
  });

  it('apiCall resolves body templates and stores response', async () => {
    const store = new MemoryKycStore();
    const providers = {
      mock: new MockHttpProvider('mock', { mockResponse: { screened: true } }),
    };
    const engine = new KycEngine(store, providers);
    const session = await engine.createSession();
    await engine.answer(session.id, 'fullName', 'John Doe');

    await engine.runStep(session.id, {
      type: 'apiCall',
      config: {
        provider: 'mock',
        operation: {
          method: 'POST',
          path: '/screen',
          body: { name: '{{answers.fullName}}' },
        },
        storeAt: 'sanctions',
      },
    });

    const updated = await engine.getSession(session.id);
    expect(updated?.raw?.sanctions).toEqual({ screened: true });
  });

  it('apiCall throws when provider not found', async () => {
    const store = new MemoryKycStore();
    const engine = new KycEngine(store, {});
    const session = await engine.createSession();
    await expect(
      engine.runStep(session.id, {
        type: 'apiCall',
        config: { provider: 'missing', operation: { method: 'GET', path: '/' }, storeAt: 'x' },
      }),
    ).rejects.toThrow('Provider missing not found');
  });

  it('nextChatTurn returns first unanswered question', () => {
    const session = {
      id: 's1',
      tenantId: 't1',
      createdAt: '',
      updatedAt: '',
      answers: {},
      documents: {},
      raw: {},
      normalized: {},
      checks: {},
    };
    const flow = {
      steps: [
        { type: 'ask' as const, config: { fieldPath: 'a', message: 'Q1?', inputType: 'text' as const } },
        { type: 'ask' as const, config: { fieldPath: 'b', message: 'Q2?', inputType: 'text' as const } },
      ],
    };
    const turn = nextChatTurn(session, flow);
    expect(turn?.message).toBe('Q1?');
    expect(turn?.fieldPath).toBe('a');
  });

  it('validateAndThrow throws KycValidationError', () => {
    const { validateAndThrow } = require('../src/kyc/engine/steps/validate');
    const session = {
      id: 's1',
      tenantId: undefined as string | undefined,
      createdAt: '',
      updatedAt: '',
      answers: { email: 'bad' },
      documents: {},
      raw: {},
      normalized: {},
      checks: {},
    };
    expect(() =>
      validateAndThrow(session, {
        from: 'answers',
        schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } }, required: ['email'] },
      }),
    ).toThrow('Validation failed');
  });

  it('runStep validate throws on failure', async () => {
    const store = new MemoryKycStore();
    const engine = new KycEngine(store, {});
    const session = await engine.createSession();
    await engine.answer(session.id, 'email', 'not-valid');

    await expect(
      engine.runStep(session.id, {
        type: 'validate',
        config: {
          from: 'answers',
          schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } }, required: ['email'] },
        },
      }),
    ).rejects.toThrow('Validation failed');
  });

  it('runFlow skips ask steps and runs non-ask steps', async () => {
    const store = new MemoryKycStore();
    const mockProvider = new MockHttpProvider('mock', { mockResponse: { match: false, status: 'clear' } });
    const engine = new KycEngine(store, { sanctions: mockProvider });
    const session = await engine.createSession();
    await engine.answer(session.id, 'fullName', 'Jane');
    await engine.answer(session.id, 'dateOfBirth', '1990-01-01');
    await engine.answer(session.id, 'nationality', 'SE');

    const flow = {
      steps: [
        { type: 'ask' as const, config: { fieldPath: 'fullName', message: 'Name?', inputType: 'text' as const } },
        { type: 'validate' as const, config: { from: 'answers', schema: { type: 'object', properties: { fullName: {} }, required: ['fullName'] } } },
        { type: 'apiCall' as const, config: { provider: 'sanctions', operation: { method: 'POST', path: '/screen', body: { name: '{{answers.fullName}}' } }, storeAt: 'sanctions' } },
        { type: 'transform' as const, config: { mappings: [{ from: 'sanctions.status', to: 'status' }] } },
        { type: 'decide' as const, config: { ruleset: { rules: [{ when: { path: 'status', eq: 'clear' }, reason: 'OK', status: 'APPROVED' }], defaultStatus: 'REVIEW' } } },
      ],
    };

    await engine.runFlow(session.id, flow);
    const updated = await engine.getSession(session.id);
    expect(updated?.decision?.status).toBe('APPROVED');
    expect((updated?.raw?.sanctions as { status?: string })?.status).toBe('clear');
  });

  it('runStep transform and decide work', async () => {
    const store = new MemoryKycStore();
    const engine = new KycEngine(store, {});
    const session = await engine.createSession();
    await store.update(session.id, {
      raw: { sanctions: { match: false, status: 'clear' } },
    });

    await engine.runStep(session.id, {
      type: 'transform',
      config: {
        mappings: [
          { from: 'sanctions.match', to: 'sanctionsMatch' },
          { from: 'sanctions.status', to: 'sanctionsStatus' },
        ],
      },
    });

    let updated = await engine.getSession(session.id);
    expect(updated?.normalized?.sanctionsMatch).toBe(false);

    await engine.runStep(session.id, {
      type: 'decide',
      config: {
        ruleset: {
          rules: [{ when: { path: 'sanctionsStatus', eq: 'clear' }, reason: 'OK', status: 'APPROVED' }],
          defaultStatus: 'REVIEW',
        },
      },
    });

    updated = await engine.getSession(session.id);
    expect(updated?.decision?.status).toBe('APPROVED');
  });

  it('runStep returns null for missing session', async () => {
    const store = new MemoryKycStore();
    const engine = new KycEngine(store, {});
    const res = await engine.runStep('nope', { type: 'ask', config: { fieldPath: 'x', message: 'X?', inputType: 'text' } });
    expect(res).toBeNull();
  });

  it('validate returns not found for missing session', async () => {
    const store = new MemoryKycStore();
    const engine = new KycEngine(store, {});
    const r = await engine.validate('nope', { from: 'answers', schema: { type: 'object' } });
    expect(r.valid).toBe(false);
    expect(r.errors).toContainEqual(expect.objectContaining({ path: '' }));
  });

  it('runFlow throws when session not found', async () => {
    const store = new MemoryKycStore();
    const engine = new KycEngine(store, {});
    await expect(engine.runFlow('nope', { steps: [] })).rejects.toThrow('Session not found');
  });

  it('runStep verify updates checks', async () => {
    const store = new MemoryKycStore();
    const engine = new KycEngine(store, {});
    const session = await engine.createSession();
    await store.update(session.id, { raw: { doc: { ok: true } } });

    await engine.runStep(session.id, {
      type: 'verify',
      config: { checkType: 'doc_verify', resultPath: 'doc', checkName: 'doc_check' },
    });

    const updated = await engine.getSession(session.id);
    expect(updated?.checks?.doc_check?.ok).toBe(true);
  });

  it('nextChatTurn returns null when all answered', () => {
    const session = {
      id: 's1',
      tenantId: 't1',
      createdAt: '',
      updatedAt: '',
      answers: { a: 'x', b: 'y' },
      documents: {},
      raw: {},
      normalized: {},
      checks: {},
    };
    const flow = {
      steps: [
        { type: 'ask' as const, config: { fieldPath: 'a', message: 'Q1?', inputType: 'text' as const } },
        { type: 'ask' as const, config: { fieldPath: 'b', message: 'Q2?', inputType: 'text' as const } },
      ],
    };
    expect(nextChatTurn(session, flow)).toBeNull();
  });
});
