import { HazelModule } from '@hazeljs/core';
import { I18nService } from './i18n.service';
import { TranslationLoader } from './translation.loader';
import { LocaleMiddleware } from './i18n.middleware';
import { I18nOptions, ResolvedI18nOptions } from './types';
import { resolve as resolvePath } from 'path';

const I18N_OPTIONS_TOKEN = 'I18N_OPTIONS';

/**
 * Resolves user-supplied options and fills in all defaults.
 */
function resolveOptions(options: I18nOptions): ResolvedI18nOptions {
  const defaultLocale = options.defaultLocale ?? 'en';
  return {
    defaultLocale,
    fallbackLocale: options.fallbackLocale ?? defaultLocale,
    translationsPath: options.translationsPath
      ? resolvePath(process.cwd(), options.translationsPath)
      : resolvePath(process.cwd(), 'translations'),
    detection: options.detection ?? ['query', 'cookie', 'header'],
    queryParam: options.queryParam ?? 'lang',
    cookieName: options.cookieName ?? 'locale',
    isGlobal: options.isGlobal ?? true,
  };
}

/**
 * I18nModule — internationalization module for HazelJS.
 *
 * Register once in your root module using `I18nModule.forRoot()`.  The module
 * loads all `<locale>.json` files from the configured `translationsPath` at
 * startup and makes `I18nService` and `LocaleMiddleware` available for
 * injection across the entire application.
 *
 * @example
 * ```ts
 * \@HazelModule({
 *   imports: [
 *     I18nModule.forRoot({
 *       defaultLocale: 'en',
 *       fallbackLocale: 'en',
 *       translationsPath: './translations',
 *       detection: ['query', 'cookie', 'header'],
 *     }),
 *   ],
 *   controllers: [AppController],
 * })
 * export class AppModule {}
 * ```
 */
@HazelModule({
  providers: [],
  exports: [],
})
export class I18nModule {
  /**
   * Synchronous configuration.  Options are resolved eagerly, and
   * translations are loaded before the service instance is made available.
   */
  static forRoot(options: I18nOptions = {}): {
    module: typeof I18nModule;
    providers: Array<{
      provide: string | typeof I18nService | typeof LocaleMiddleware;
      useFactory?: (...args: unknown[]) => unknown;
      useValue?: unknown;
      inject?: string[];
    }>;
    exports: Array<typeof I18nService | typeof LocaleMiddleware>;
    global: boolean;
  } {
    const resolved = resolveOptions(options);

    return {
      module: I18nModule,
      providers: [
        {
          provide: I18N_OPTIONS_TOKEN,
          useValue: resolved,
        },
        {
          provide: I18nService,
          useFactory: async (...args: unknown[]): Promise<I18nService> => {
            const opts = args[0] as ResolvedI18nOptions;
            const store = await TranslationLoader.load(opts.translationsPath);
            const service = new I18nService();
            service.initialize(store, opts);
            return service;
          },
          inject: [I18N_OPTIONS_TOKEN],
        },
        {
          provide: LocaleMiddleware,
          useFactory: (...args: unknown[]): LocaleMiddleware => {
            const opts = args[0] as ResolvedI18nOptions;
            return new LocaleMiddleware(opts);
          },
          inject: [I18N_OPTIONS_TOKEN],
        },
      ],
      exports: [I18nService, LocaleMiddleware],
      global: resolved.isGlobal,
    };
  }

  /**
   * Asynchronous configuration — use when options must be resolved from the
   * container (e.g. from ConfigService).
   *
   * @example
   * ```ts
   * I18nModule.forRootAsync({
   *   useFactory: (config: ConfigService) => ({
   *     defaultLocale: config.get('LOCALE', 'en'),
   *     translationsPath: config.get('TRANSLATIONS_PATH', './translations'),
   *   }),
   *   inject: [ConfigService],
   * })
   * ```
   */
  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<I18nOptions> | I18nOptions;
    inject?: unknown[];
  }): {
    module: typeof I18nModule;
    providers: Array<{
      provide: string | typeof I18nService | typeof LocaleMiddleware;
      useFactory: (...args: unknown[]) => unknown;
      inject?: unknown[];
    }>;
    exports: Array<typeof I18nService | typeof LocaleMiddleware>;
    global: boolean;
  } {
    return {
      module: I18nModule,
      providers: [
        {
          provide: I18N_OPTIONS_TOKEN,
          useFactory: async (...args: unknown[]): Promise<ResolvedI18nOptions> => {
            const userOptions = await options.useFactory(...args);
            return resolveOptions(userOptions);
          },
          inject: options.inject ?? [],
        },
        {
          provide: I18nService,
          useFactory: async (...args: unknown[]): Promise<I18nService> => {
            const opts = args[0] as ResolvedI18nOptions;
            const store = await TranslationLoader.load(opts.translationsPath);
            const service = new I18nService();
            service.initialize(store, opts);
            return service;
          },
          inject: [I18N_OPTIONS_TOKEN],
        },
        {
          provide: LocaleMiddleware,
          useFactory: (...args: unknown[]): LocaleMiddleware => {
            const opts = args[0] as ResolvedI18nOptions;
            return new LocaleMiddleware(opts);
          },
          inject: [I18N_OPTIONS_TOKEN],
        },
      ],
      exports: [I18nService, LocaleMiddleware],
      global: true,
    };
  }
}
