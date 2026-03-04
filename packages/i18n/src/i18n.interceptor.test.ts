jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  Service: () => () => undefined,
}));

import { I18nInterceptor } from './i18n.interceptor';
import { I18nService } from './i18n.service';
import { LOCALE_KEY } from './i18n.middleware';
import { LocaleStore, ResolvedI18nOptions } from './types';

const DEFAULT_OPTIONS: ResolvedI18nOptions = {
  defaultLocale: 'en',
  fallbackLocale: 'en',
  translationsPath: './translations',
  detection: ['query', 'cookie', 'header'],
  queryParam: 'lang',
  cookieName: 'locale',
  isGlobal: true,
};

function makeService(store: LocaleStore = new Map(), opts = DEFAULT_OPTIONS): I18nService {
  const svc = new I18nService();
  svc.initialize(store, opts);
  return svc;
}

function makeStore(entries: Record<string, Record<string, unknown>>): LocaleStore {
  const store: LocaleStore = new Map();
  for (const [locale, map] of Object.entries(entries)) {
    store.set(locale, map as never);
  }
  return store;
}

function makeContext(locale?: string): Record<string, unknown> {
  const req: Record<string, unknown> = {};
  if (locale) req[LOCALE_KEY] = locale;
  return { req };
}

describe('I18nInterceptor', () => {
  describe('intercept()', () => {
    it('passes through null result', async () => {
      const svc = makeService();
      const interceptor = new I18nInterceptor(svc);
      const next = jest.fn().mockResolvedValue(null);
      const result = await interceptor.intercept(makeContext() as never, next);
      expect(result).toBeNull();
    });

    it('passes through non-object result (string)', async () => {
      const svc = makeService();
      const interceptor = new I18nInterceptor(svc);
      const next = jest.fn().mockResolvedValue('plain string');
      const result = await interceptor.intercept(makeContext() as never, next);
      expect(result).toBe('plain string');
    });

    it('passes through array result', async () => {
      const svc = makeService();
      const interceptor = new I18nInterceptor(svc);
      const next = jest.fn().mockResolvedValue([1, 2, 3]);
      const result = await interceptor.intercept(makeContext() as never, next);
      expect(result).toEqual([1, 2, 3]);
    });

    it('passes through object without message field', async () => {
      const svc = makeService();
      const interceptor = new I18nInterceptor(svc);
      const body = { data: { id: 1 } };
      const next = jest.fn().mockResolvedValue(body);
      const result = await interceptor.intercept(makeContext() as never, next);
      expect(result).toBe(body);
    });

    it('passes through when message is not a string', async () => {
      const svc = makeService();
      const interceptor = new I18nInterceptor(svc);
      const body = { message: 42 };
      const next = jest.fn().mockResolvedValue(body);
      const result = await interceptor.intercept(makeContext() as never, next);
      expect(result).toBe(body);
    });

    it('translates the message field when a key is found', async () => {
      const store = makeStore({ en: { user: { created: 'User created successfully.' } } });
      const svc = makeService(store);
      const interceptor = new I18nInterceptor(svc);
      const body = { message: 'user.created', data: { id: 1 } };
      const next = jest.fn().mockResolvedValue(body);

      const result = await interceptor.intercept(makeContext('en') as never, next);
      expect(result).toEqual({ message: 'User created successfully.', data: { id: 1 } });
    });

    it('preserves the original message when the key is not found', async () => {
      const svc = makeService(new Map());
      const interceptor = new I18nInterceptor(svc);
      const body = { message: 'unknown.key' };
      const next = jest.fn().mockResolvedValue(body);
      const result = await interceptor.intercept(makeContext('en') as never, next);
      expect(result).toBe(body);
    });

    it('uses locale from request context', async () => {
      const store = makeStore({
        en: { greeting: 'Hello' },
        fr: { greeting: 'Bonjour' },
      });
      const svc = makeService(store, { ...DEFAULT_OPTIONS, defaultLocale: 'en' });
      const interceptor = new I18nInterceptor(svc);
      const body = { message: 'greeting' };
      const next = jest.fn().mockResolvedValue(body);

      const result = await interceptor.intercept(makeContext('fr') as never, next);
      expect((result as Record<string, unknown>).message).toBe('Bonjour');
    });

    it('handles context without req (no locale)', async () => {
      const store = makeStore({ en: { hi: 'Hi there' } });
      const svc = makeService(store);
      const interceptor = new I18nInterceptor(svc);
      const body = { message: 'hi' };
      const next = jest.fn().mockResolvedValue(body);
      // context with no req
      const result = await interceptor.intercept({} as never, next);
      expect((result as Record<string, unknown>).message).toBe('Hi there');
    });

    it('handles context with "request" key instead of "req"', async () => {
      const store = makeStore({ en: { bye: 'Goodbye' } });
      const svc = makeService(store);
      const interceptor = new I18nInterceptor(svc);
      const body = { message: 'bye' };
      const next = jest.fn().mockResolvedValue(body);
      const ctx = { request: { [LOCALE_KEY]: 'en' } };
      const result = await interceptor.intercept(ctx as never, next);
      expect((result as Record<string, unknown>).message).toBe('Goodbye');
    });
  });
});
