/**
 * Supported locale detection strategies, in order of priority.
 */
export type LocaleDetectionStrategy = 'query' | 'cookie' | 'header';

/**
 * A flat or nested map of translation keys to values.
 * Nested objects represent namespaced keys (e.g. "errors.notFound").
 * Leaf values are translation strings, which may contain {placeholder} tokens
 * and optional plural forms via a "one"/"other" sub-object.
 */
export type TranslationValue =
  | string
  | { one: string; other: string; [form: string]: string }
  | { [key: string]: TranslationValue };

export type TranslationMap = Record<string, TranslationValue>;

/**
 * In-memory store: locale → flat translation map.
 */
export type LocaleStore = Map<string, TranslationMap>;

/**
 * Options for interpolating variables and selecting plural forms.
 */
export interface TranslateOptions {
  /**
   * Used for plural rule selection.
   */
  count?: number;

  /**
   * Key-value pairs substituted into {placeholder} tokens.
   */
  vars?: Record<string, string | number>;

  /**
   * Override the locale for this single call.
   */
  locale?: string;
}

/**
 * Configuration options for I18nModule.forRoot().
 */
export interface I18nOptions {
  /**
   * The locale used when no locale can be detected.
   * @default 'en'
   */
  defaultLocale?: string;

  /**
   * The locale to fall back to when a key is missing in the requested locale.
   * @default same as defaultLocale
   */
  fallbackLocale?: string;

  /**
   * Absolute or relative path to the directory containing JSON translation files.
   * Files must be named <locale>.json (e.g. en.json, fr.json).
   * @default './translations'
   */
  translationsPath?: string;

  /**
   * Ordered list of locale-detection strategies to apply per request.
   * @default ['query', 'cookie', 'header']
   */
  detection?: LocaleDetectionStrategy[];

  /**
   * Name of the query-string parameter to check.
   * @default 'lang'
   */
  queryParam?: string;

  /**
   * Name of the cookie to check.
   * @default 'locale'
   */
  cookieName?: string;

  /**
   * Whether to register this module globally so it does not need to be
   * imported in every feature module.
   * @default true
   */
  isGlobal?: boolean;
}

/**
 * Fully resolved options with all defaults applied.
 */
export type ResolvedI18nOptions = Required<I18nOptions>;
