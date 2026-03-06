jest.mock('@hazeljs/core', () => ({
  __esModule: true,
}));

import { LocaleMiddleware, getLocaleFromRequest, LOCALE_KEY } from './i18n.middleware';
import { ResolvedI18nOptions } from './types';

const DEFAULT_OPTIONS: ResolvedI18nOptions = {
  defaultLocale: 'en',
  fallbackLocale: 'en',
  translationsPath: './translations',
  detection: ['query', 'cookie', 'header'],
  queryParam: 'lang',
  cookieName: 'locale',
  isGlobal: true,
};

function makeReq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    query: {},
    headers: {},
    ...overrides,
  };
}

function makeRes(): { setHeader: jest.Mock; [key: string]: unknown } {
  return { setHeader: jest.fn() };
}

describe('LocaleMiddleware', () => {
  let middleware: LocaleMiddleware;
  let next: jest.Mock;

  beforeEach(() => {
    middleware = new LocaleMiddleware(DEFAULT_OPTIONS);
    next = jest.fn();
  });

  describe('handle()', () => {
    it('calls next()', () => {
      const req = makeReq();
      const res = makeRes();
      middleware.handle(req as never, res as never, next);
      expect(next).toHaveBeenCalled();
    });

    it('sets the locale on the request object', () => {
      const req = makeReq({ query: { lang: 'fr' } });
      const res = makeRes();
      middleware.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('fr');
    });

    it('sets Content-Language response header', () => {
      const req = makeReq({ query: { lang: 'de' } });
      const res = makeRes();
      middleware.handle(req as never, res as never, next);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Language', 'de');
    });

    it('falls back to defaultLocale when no strategy matches', () => {
      const req = makeReq();
      const res = makeRes();
      middleware.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('en');
    });
  });

  describe('query strategy', () => {
    it('picks locale from query parameter', () => {
      const req = makeReq({ query: { lang: 'fr' } });
      const res = makeRes();
      middleware.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('fr');
    });

    it('ignores invalid locale in query', () => {
      const req = makeReq({ query: { lang: '!invalid!' } });
      const res = makeRes();
      middleware.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('en');
    });

    it('uses custom queryParam name', () => {
      const mw = new LocaleMiddleware({ ...DEFAULT_OPTIONS, queryParam: 'locale' });
      const req = makeReq({ query: { locale: 'ja' } });
      const res = makeRes();
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('ja');
    });
  });

  describe('cookie strategy', () => {
    it('picks locale from cookie header', () => {
      const req = makeReq({ headers: { cookie: 'locale=fr; theme=dark' } });
      const res = makeRes();
      const mw = new LocaleMiddleware({ ...DEFAULT_OPTIONS, detection: ['cookie'] });
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('fr');
    });

    it('picks locale from Cookie (capitalized) header', () => {
      const req = makeReq({ headers: { Cookie: 'locale=de' } });
      const res = makeRes();
      const mw = new LocaleMiddleware({ ...DEFAULT_OPTIONS, detection: ['cookie'] });
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('de');
    });

    it('falls back to default when cookie is absent', () => {
      const req = makeReq({ headers: {} });
      const res = makeRes();
      const mw = new LocaleMiddleware({ ...DEFAULT_OPTIONS, detection: ['cookie'] });
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('en');
    });

    it('falls back when cookie name does not match', () => {
      const req = makeReq({ headers: { cookie: 'othercookie=fr' } });
      const res = makeRes();
      const mw = new LocaleMiddleware({ ...DEFAULT_OPTIONS, detection: ['cookie'] });
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('en');
    });

    it('handles cookie values with = in the value', () => {
      const req = makeReq({ headers: { cookie: 'locale=zh-TW; token=abc=def' } });
      const res = makeRes();
      const mw = new LocaleMiddleware({ ...DEFAULT_OPTIONS, detection: ['cookie'] });
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('zh-TW');
    });

    it('handles URL-encoded cookie values', () => {
      const req = makeReq({ headers: { cookie: 'locale=zh-TW' } });
      const res = makeRes();
      const mw = new LocaleMiddleware({ ...DEFAULT_OPTIONS, detection: ['cookie'] });
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('zh-TW');
    });

    it('uses custom cookieName', () => {
      const req = makeReq({ headers: { cookie: 'lang_pref=ja' } });
      const res = makeRes();
      const mw = new LocaleMiddleware({
        ...DEFAULT_OPTIONS,
        cookieName: 'lang_pref',
        detection: ['cookie'],
      });
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('ja');
    });
  });

  describe('header strategy', () => {
    it('picks locale from Accept-Language header', () => {
      const req = makeReq({ headers: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' } });
      const res = makeRes();
      const mw = new LocaleMiddleware({ ...DEFAULT_OPTIONS, detection: ['header'] });
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('fr-FR');
    });

    it('picks locale from Accept-Language (capitalized) header', () => {
      const req = makeReq({ headers: { 'Accept-Language': 'de' } });
      const res = makeRes();
      const mw = new LocaleMiddleware({ ...DEFAULT_OPTIONS, detection: ['header'] });
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('de');
    });

    it('sorts by q-value and picks highest priority locale', () => {
      const req = makeReq({
        headers: { 'accept-language': 'en;q=0.5,ja;q=0.9,fr;q=0.7' },
      });
      const res = makeRes();
      const mw = new LocaleMiddleware({ ...DEFAULT_OPTIONS, detection: ['header'] });
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('ja');
    });

    it('falls back to default when no Accept-Language header', () => {
      const req = makeReq({ headers: {} });
      const res = makeRes();
      const mw = new LocaleMiddleware({ ...DEFAULT_OPTIONS, detection: ['header'] });
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('en');
    });
  });

  describe('detection priority', () => {
    it('prefers query over cookie and header', () => {
      const req = makeReq({
        query: { lang: 'fr' },
        headers: {
          cookie: 'locale=de',
          'accept-language': 'ja',
        },
      });
      const res = makeRes();
      middleware.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('fr');
    });

    it('falls through to cookie when query has no valid locale', () => {
      const req = makeReq({
        query: {},
        headers: {
          cookie: 'locale=de',
          'accept-language': 'ja',
        },
      });
      const res = makeRes();
      middleware.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('de');
    });

    it('falls through to header when query and cookie have no valid locale', () => {
      const req = makeReq({
        query: {},
        headers: {
          'accept-language': 'ja',
        },
      });
      const res = makeRes();
      middleware.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('ja');
    });

    it('respects custom detection order [header, query]', () => {
      const mw = new LocaleMiddleware({
        ...DEFAULT_OPTIONS,
        detection: ['header', 'query'],
      });
      const req = makeReq({
        query: { lang: 'fr' },
        headers: { 'accept-language': 'de' },
      });
      const res = makeRes();
      mw.handle(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('de');
    });
  });

  describe('LocaleMiddleware.create()', () => {
    it('returns a middleware function', () => {
      const fn = LocaleMiddleware.create(DEFAULT_OPTIONS);
      expect(typeof fn).toBe('function');
    });

    it('created function applies locale detection', () => {
      const fn = LocaleMiddleware.create(DEFAULT_OPTIONS);
      const req = makeReq({ query: { lang: 'fr' } });
      const res = makeRes();
      fn(req as never, res as never, next);
      expect(req[LOCALE_KEY]).toBe('fr');
    });
  });
});

describe('getLocaleFromRequest()', () => {
  it('returns the locale set on the request', () => {
    const req = { [LOCALE_KEY]: 'fr' };
    expect(getLocaleFromRequest(req as never)).toBe('fr');
  });

  it('returns undefined when locale is not set', () => {
    expect(getLocaleFromRequest({} as never)).toBeUndefined();
  });
});
