jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  Service: () => () => undefined,
}));

import { I18nService, I18nFormatter } from './i18n.service';
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

function makeStore(entries: Record<string, Record<string, unknown>>): LocaleStore {
  const store: LocaleStore = new Map();
  for (const [locale, map] of Object.entries(entries)) {
    store.set(locale, map as never);
  }
  return store;
}

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    service = new I18nService();
  });

  describe('getCurrentLocale()', () => {
    it('returns "en" when not initialized', () => {
      expect(service.getCurrentLocale()).toBe('en');
    });

    it('returns the configured defaultLocale', () => {
      service.initialize(new Map(), { ...DEFAULT_OPTIONS, defaultLocale: 'fr' });
      expect(service.getCurrentLocale()).toBe('fr');
    });
  });

  describe('getLocales()', () => {
    it('returns empty array when no translations loaded', () => {
      service.initialize(new Map(), DEFAULT_OPTIONS);
      expect(service.getLocales()).toEqual([]);
    });

    it('returns all locale codes from the store', () => {
      const store = makeStore({ en: {}, fr: {}, de: {} });
      service.initialize(store, DEFAULT_OPTIONS);
      expect(service.getLocales()).toEqual(expect.arrayContaining(['en', 'fr', 'de']));
    });
  });

  describe('getKeys()', () => {
    it('returns empty array for unknown locale', () => {
      service.initialize(new Map(), DEFAULT_OPTIONS);
      expect(service.getKeys('xx')).toEqual([]);
    });

    it('returns flat keys for simple map', () => {
      const store = makeStore({ en: { hello: 'Hello', bye: 'Goodbye' } });
      service.initialize(store, DEFAULT_OPTIONS);
      expect(service.getKeys('en')).toEqual(expect.arrayContaining(['hello', 'bye']));
    });

    it('returns dot-notation keys for nested map', () => {
      const store = makeStore({ en: { errors: { notFound: 'Not found', invalid: 'Invalid' } } });
      service.initialize(store, DEFAULT_OPTIONS);
      expect(service.getKeys('en')).toEqual(
        expect.arrayContaining(['errors.notFound', 'errors.invalid'])
      );
    });

    it('does not flatten plural objects (one/other keys)', () => {
      const store = makeStore({ en: { items: { one: '1 item', other: '{count} items' } } });
      service.initialize(store, DEFAULT_OPTIONS);
      expect(service.getKeys('en')).toContain('items');
    });

    it('uses getCurrentLocale() when no locale arg given', () => {
      const store = makeStore({ en: { hi: 'Hi' } });
      service.initialize(store, { ...DEFAULT_OPTIONS, defaultLocale: 'en' });
      expect(service.getKeys()).toContain('hi');
    });
  });

  describe('has()', () => {
    beforeEach(() => {
      const store = makeStore({ en: { greeting: 'Hello', errors: { notFound: 'Not found' } } });
      service.initialize(store, DEFAULT_OPTIONS);
    });

    it('returns true for existing key', () => {
      expect(service.has('greeting')).toBe(true);
    });

    it('returns true for nested key', () => {
      expect(service.has('errors.notFound')).toBe(true);
    });

    it('returns false for missing key', () => {
      expect(service.has('nonexistent')).toBe(false);
    });

    it('returns false for a locale with no translations when fallback is the same', () => {
      // fallbackLocale matches the requested locale → no cross-locale fallback
      const svc = new I18nService();
      const s = makeStore({ en: { greeting: 'Hello' } });
      svc.initialize(s, { ...DEFAULT_OPTIONS, defaultLocale: 'fr', fallbackLocale: 'fr' });
      expect(svc.has('greeting', 'fr')).toBe(false);
    });
  });

  describe('t()', () => {
    describe('basic translation', () => {
      beforeEach(() => {
        const store = makeStore({
          en: {
            welcome: 'Welcome!',
            nested: { key: 'Nested value' },
          },
          fr: {
            welcome: 'Bienvenue !',
          },
        });
        service.initialize(store, DEFAULT_OPTIONS);
      });

      it('returns translated string', () => {
        expect(service.t('welcome')).toBe('Welcome!');
      });

      it('returns the key when not found', () => {
        expect(service.t('missing.key')).toBe('missing.key');
      });

      it('translates a nested key', () => {
        expect(service.t('nested.key')).toBe('Nested value');
      });

      it('uses locale override from opts', () => {
        expect(service.t('welcome', { locale: 'fr' })).toBe('Bienvenue !');
      });
    });

    describe('interpolation', () => {
      beforeEach(() => {
        const store = makeStore({
          en: {
            greeting: 'Hello, {name}!',
            multi: '{a} and {b}',
            missing_var: 'Hello, {unknown}!',
          },
        });
        service.initialize(store, DEFAULT_OPTIONS);
      });

      it('replaces placeholders with vars', () => {
        expect(service.t('greeting', { vars: { name: 'Alice' } })).toBe('Hello, Alice!');
      });

      it('replaces multiple placeholders', () => {
        expect(service.t('multi', { vars: { a: 'foo', b: 'bar' } })).toBe('foo and bar');
      });

      it('leaves unmatched placeholders as-is', () => {
        expect(service.t('missing_var', { vars: {} })).toBe('Hello, {unknown}!');
      });

      it('accepts numeric var values', () => {
        expect(service.t('greeting', { vars: { name: 42 } })).toBe('Hello, 42!');
      });
    });

    describe('pluralization', () => {
      beforeEach(() => {
        const store = makeStore({
          en: {
            items: { one: '1 item', other: '{count} items' },
            cats: { one: 'one cat', other: 'many cats' },
          },
        });
        service.initialize(store, { ...DEFAULT_OPTIONS, defaultLocale: 'en' });
      });

      it('selects "one" form for count=1', () => {
        expect(service.t('items', { count: 1, vars: { count: '1' } })).toBe('1 item');
      });

      it('selects "other" form for count > 1', () => {
        expect(service.t('items', { count: 3, vars: { count: '3' } })).toBe('3 items');
      });

      it('selects "other" form when count is undefined', () => {
        expect(service.t('cats')).toBe('many cats');
      });

      it('falls back to "one" if "other" missing and count undefined', () => {
        const store = makeStore({ en: { only_one: { one: 'just one' } } });
        service.initialize(store, DEFAULT_OPTIONS);
        expect(service.t('only_one')).toBe('just one');
      });
    });

    describe('fallback locale', () => {
      it('falls back to fallbackLocale when key is missing in requested locale', () => {
        const store = makeStore({
          en: { only_en: 'English only' },
          fr: {},
        });
        service.initialize(store, {
          ...DEFAULT_OPTIONS,
          defaultLocale: 'fr',
          fallbackLocale: 'en',
        });
        expect(service.t('only_en')).toBe('English only');
      });

      it('returns key when neither locale nor fallback has the key', () => {
        const store = makeStore({ en: {}, fr: {} });
        service.initialize(store, {
          ...DEFAULT_OPTIONS,
          defaultLocale: 'fr',
          fallbackLocale: 'en',
        });
        expect(service.t('missing')).toBe('missing');
      });

      it('does not recurse when fallback equals locale', () => {
        const store = makeStore({ en: {} });
        service.initialize(store, {
          ...DEFAULT_OPTIONS,
          defaultLocale: 'en',
          fallbackLocale: 'en',
        });
        expect(service.t('missing')).toBe('missing');
      });
    });

    describe('edge cases', () => {
      it('returns JSON.stringify for a nested object value (namespace path)', () => {
        const store = makeStore({ en: { ns: { sub: 'value' } } });
        service.initialize(store, DEFAULT_OPTIONS);
        // Requesting 'ns' returns the object itself, which gets JSON.stringified
        const result = service.t('ns');
        expect(result).toBe(JSON.stringify({ sub: 'value' }));
      });

      it('returns key when traversal hits a null node', () => {
        const store = makeStore({ en: { parent: 'string_not_object' } });
        service.initialize(store, DEFAULT_OPTIONS);
        expect(service.t('parent.child')).toBe('parent.child');
      });

      it('handles invalid Intl locale gracefully (falls back to "other")', () => {
        const store = makeStore({ xx: { items: { one: '1 item', other: 'many items' } } });
        service.initialize(store, { ...DEFAULT_OPTIONS, defaultLocale: 'xx' });
        expect(service.t('items', { count: 1 })).toBeTruthy();
      });
    });
  });
});

describe('I18nFormatter', () => {
  let service: I18nService;
  let formatter: I18nFormatter;

  beforeEach(() => {
    service = new I18nService();
    service.initialize(new Map(), { ...DEFAULT_OPTIONS, defaultLocale: 'en' });
    formatter = service.format;
  });

  describe('number()', () => {
    it('formats a number using default locale', () => {
      const result = formatter.number(1234);
      expect(result).toMatch(/1[,.]?234/);
    });

    it('accepts an explicit locale', () => {
      const result = formatter.number(1234.5, 'de');
      expect(typeof result).toBe('string');
    });

    it('accepts Intl.NumberFormatOptions', () => {
      const result = formatter.number(1234.567, 'en', { maximumFractionDigits: 2 });
      expect(result).toMatch(/1,234\.57/);
    });
  });

  describe('date()', () => {
    it('formats a Date object', () => {
      const d = new Date('2026-03-04T00:00:00Z');
      const result = formatter.date(d, 'en');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('formats a timestamp number', () => {
      const ts = new Date('2026-01-01').getTime();
      const result = formatter.date(ts, 'en');
      expect(typeof result).toBe('string');
    });

    it('uses default locale when none provided', () => {
      const result = formatter.date(new Date());
      expect(typeof result).toBe('string');
    });
  });

  describe('currency()', () => {
    it('formats USD by default', () => {
      const result = formatter.currency(49.99, 'en');
      expect(result).toContain('49.99');
    });

    it('formats EUR with explicit currency code', () => {
      const result = formatter.currency(10, 'de', 'EUR');
      expect(typeof result).toBe('string');
    });

    it('uses default locale when none provided', () => {
      const result = formatter.currency(100);
      expect(typeof result).toBe('string');
    });
  });

  describe('relative()', () => {
    it('formats a relative time', () => {
      const result = formatter.relative(-3, 'day', 'en');
      expect(result).toMatch(/3 days? ago/);
    });

    it('formats future time', () => {
      const result = formatter.relative(2, 'hour', 'en');
      expect(result).toMatch(/2 hours?/);
    });

    it('uses default locale when none provided', () => {
      const result = formatter.relative(1, 'month');
      expect(typeof result).toBe('string');
    });

    it('accepts Intl.RelativeTimeFormatOptions', () => {
      const result = formatter.relative(-1, 'day', 'en', { numeric: 'auto' });
      expect(typeof result).toBe('string');
    });
  });
});
