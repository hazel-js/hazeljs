jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  HazelModule: () => () => undefined,
  Service: () => () => undefined,
}));

jest.mock('./translation.loader', () => ({
  TranslationLoader: {
    load: jest.fn().mockResolvedValue(new Map()),
  },
}));

import { I18nModule } from './i18n.module';
import { I18nService } from './i18n.service';
import { LocaleMiddleware } from './i18n.middleware';
import { TranslationLoader } from './translation.loader';

const mockLoad = TranslationLoader.load as jest.MockedFunction<typeof TranslationLoader.load>;

describe('I18nModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoad.mockResolvedValue(new Map());
  });

  describe('forRoot()', () => {
    it('returns module reference', () => {
      const result = I18nModule.forRoot();
      expect(result.module).toBe(I18nModule);
    });

    it('exports I18nService and LocaleMiddleware', () => {
      const result = I18nModule.forRoot();
      expect(result.exports).toContain(I18nService);
      expect(result.exports).toContain(LocaleMiddleware);
    });

    it('sets global to true by default', () => {
      const result = I18nModule.forRoot();
      expect(result.global).toBe(true);
    });

    it('sets global to false when isGlobal: false', () => {
      const result = I18nModule.forRoot({ isGlobal: false });
      expect(result.global).toBe(false);
    });

    it('provides I18N_OPTIONS_TOKEN, I18nService, and LocaleMiddleware', () => {
      const result = I18nModule.forRoot();
      expect(result.providers).toHaveLength(3);
    });

    it('uses custom defaultLocale', () => {
      const result = I18nModule.forRoot({ defaultLocale: 'fr' });
      const optionsProvider = result.providers.find((p) => p.provide === 'I18N_OPTIONS');
      expect((optionsProvider?.useValue as Record<string, unknown>)?.defaultLocale).toBe('fr');
    });

    it('sets fallbackLocale to defaultLocale when not specified', () => {
      const result = I18nModule.forRoot({ defaultLocale: 'de' });
      const optionsProvider = result.providers.find((p) => p.provide === 'I18N_OPTIONS');
      expect((optionsProvider?.useValue as Record<string, unknown>)?.fallbackLocale).toBe('de');
    });

    it('sets custom fallbackLocale when specified', () => {
      const result = I18nModule.forRoot({ defaultLocale: 'fr', fallbackLocale: 'en' });
      const optionsProvider = result.providers.find((p) => p.provide === 'I18N_OPTIONS');
      expect((optionsProvider?.useValue as Record<string, unknown>)?.fallbackLocale).toBe('en');
    });

    it('I18nService factory creates and initializes service', async () => {
      const store = new Map([['en', { hello: 'Hello' }]]) as never;
      mockLoad.mockResolvedValue(store);

      const result = I18nModule.forRoot({ translationsPath: './trans' });
      const serviceProvider = result.providers.find((p) => p.provide === I18nService);
      const optionsProvider = result.providers.find((p) => p.provide === 'I18N_OPTIONS');
      const opts = optionsProvider?.useValue;

      const service = await serviceProvider?.useFactory?.(opts);
      expect(service).toBeInstanceOf(I18nService);
      expect(mockLoad).toHaveBeenCalled();
    });

    it('LocaleMiddleware factory creates middleware', () => {
      const result = I18nModule.forRoot();
      const mwProvider = result.providers.find((p) => p.provide === LocaleMiddleware);
      const optionsProvider = result.providers.find((p) => p.provide === 'I18N_OPTIONS');
      const opts = optionsProvider?.useValue;

      const mw = mwProvider?.useFactory?.(opts);
      expect(mw).toBeInstanceOf(LocaleMiddleware);
    });

    it('uses default translationsPath "translations" when not specified', () => {
      const result = I18nModule.forRoot();
      const optionsProvider = result.providers.find((p) => p.provide === 'I18N_OPTIONS');
      const opts = optionsProvider?.useValue as Record<string, unknown>;
      expect(typeof opts?.translationsPath).toBe('string');
      expect((opts?.translationsPath as string).endsWith('translations')).toBe(true);
    });

    it('applies default detection strategies', () => {
      const result = I18nModule.forRoot();
      const optionsProvider = result.providers.find((p) => p.provide === 'I18N_OPTIONS');
      const opts = optionsProvider?.useValue as Record<string, unknown>;
      expect(opts?.detection).toEqual(['query', 'cookie', 'header']);
    });
  });

  describe('forRootAsync()', () => {
    it('returns module reference', () => {
      const result = I18nModule.forRootAsync({ useFactory: async () => ({}) });
      expect(result.module).toBe(I18nModule);
    });

    it('exports I18nService and LocaleMiddleware', () => {
      const result = I18nModule.forRootAsync({ useFactory: async () => ({}) });
      expect(result.exports).toContain(I18nService);
      expect(result.exports).toContain(LocaleMiddleware);
    });

    it('sets global to true', () => {
      const result = I18nModule.forRootAsync({ useFactory: async () => ({}) });
      expect(result.global).toBe(true);
    });

    it('provides 3 providers', () => {
      const result = I18nModule.forRootAsync({ useFactory: async () => ({}) });
      expect(result.providers).toHaveLength(3);
    });

    it('OPTIONS factory resolves and applies defaults', async () => {
      const result = I18nModule.forRootAsync({
        useFactory: async () => ({ defaultLocale: 'ja' }),
      });
      const optionsProvider = result.providers.find((p) => p.provide === 'I18N_OPTIONS');
      const resolved = await optionsProvider?.useFactory?.();
      expect((resolved as Record<string, unknown>).defaultLocale).toBe('ja');
    });

    it('passes inject args through to useFactory', async () => {
      const factory = jest.fn().mockResolvedValue({ defaultLocale: 'ko' });
      const result = I18nModule.forRootAsync({ useFactory: factory, inject: ['CONFIG'] });
      const optionsProvider = result.providers.find((p) => p.provide === 'I18N_OPTIONS');
      await optionsProvider?.useFactory?.('some-config-value');
      expect(factory).toHaveBeenCalledWith('some-config-value');
    });

    it('I18nService factory creates and initializes service', async () => {
      const result = I18nModule.forRootAsync({ useFactory: async () => ({}) });
      const serviceProvider = result.providers.find((p) => p.provide === I18nService);

      const resolvedOpts = {
        defaultLocale: 'en',
        fallbackLocale: 'en',
        translationsPath: '/some/path',
        detection: ['query' as const],
        queryParam: 'lang',
        cookieName: 'locale',
        isGlobal: true,
      };

      const service = await serviceProvider?.useFactory?.(resolvedOpts);
      expect(service).toBeInstanceOf(I18nService);
    });

    it('LocaleMiddleware factory creates middleware', async () => {
      const result = I18nModule.forRootAsync({ useFactory: async () => ({}) });
      const mwProvider = result.providers.find((p) => p.provide === LocaleMiddleware);

      const resolvedOpts = {
        defaultLocale: 'en',
        fallbackLocale: 'en',
        translationsPath: '/some/path',
        detection: ['query' as const],
        queryParam: 'lang',
        cookieName: 'locale',
        isGlobal: true,
      };

      const mw = await mwProvider?.useFactory?.(resolvedOpts);
      expect(mw).toBeInstanceOf(LocaleMiddleware);
    });

    it('uses empty array for inject when not specified', () => {
      const result = I18nModule.forRootAsync({ useFactory: async () => ({}) });
      const optionsProvider = result.providers.find((p) => p.provide === 'I18N_OPTIONS');
      expect(optionsProvider?.inject).toEqual([]);
    });
  });
});
