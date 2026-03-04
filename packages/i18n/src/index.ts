/**
 * @hazeljs/i18n — Internationalization module for HazelJS
 *
 * Quick start:
 *
 * ```ts
 * import { I18nModule, I18nService, Lang } from '@hazeljs/i18n';
 *
 * \@HazelModule({
 *   imports: [
 *     I18nModule.forRoot({
 *       defaultLocale: 'en',
 *       translationsPath: './translations',
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */

export { I18nModule } from './i18n.module';
export { I18nService, I18nFormatter } from './i18n.service';
export { LocaleMiddleware, getLocaleFromRequest, LOCALE_KEY } from './i18n.middleware';
export { I18nInterceptor } from './i18n.interceptor';
export { TranslationLoader } from './translation.loader';
export { Lang, extractLang, LANG_QUERY_KEY } from './decorators/lang.decorator';
export type {
  I18nOptions,
  ResolvedI18nOptions,
  TranslateOptions,
  TranslationMap,
  TranslationValue,
  LocaleStore,
  LocaleDetectionStrategy,
} from './types';
