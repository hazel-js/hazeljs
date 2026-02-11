/**
 * KYC flow tests - validate step fails with Ajv errors
 */

import { KycEngine, MemoryKycStore, MockHttpProvider } from '../src';
import { KycValidationError } from '../src/core/errors';

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
});
