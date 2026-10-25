import {
  MemorySamlAuthnRequestStore,
  getDefaultSamlAuthnRequestStore,
  resetDefaultSamlAuthnRequestStore,
} from './saml-authn-request-store';

describe('MemorySamlAuthnRequestStore', () => {
  it('allows first consume and rejects replay', () => {
    const store = new MemorySamlAuthnRequestStore();
    expect(store.tryConsume('_req-1')).toBe(true);
    expect(store.tryConsume('_req-1')).toBe(false);
  });

  it('rejects empty request ids', () => {
    const store = new MemorySamlAuthnRequestStore();
    expect(store.tryConsume('')).toBe(false);
    expect(store.tryConsume('   ')).toBe(false);
  });

  it('clear() resets consumed ids', () => {
    const store = new MemorySamlAuthnRequestStore();
    expect(store.tryConsume('_req-clear')).toBe(true);
    expect(store.tryConsume('_req-clear')).toBe(false);
    store.clear();
    expect(store.tryConsume('_req-clear')).toBe(true);
  });

  it('exposes a resettable default singleton for tests', () => {
    resetDefaultSamlAuthnRequestStore();
    const a = getDefaultSamlAuthnRequestStore();
    expect(a.tryConsume('_singleton')).toBe(true);
    expect(a.tryConsume('_singleton')).toBe(false);
    resetDefaultSamlAuthnRequestStore();
    const b = getDefaultSamlAuthnRequestStore();
    expect(b.tryConsume('_singleton')).toBe(true);
  });
});
