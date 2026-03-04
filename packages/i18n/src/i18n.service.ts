import { Service } from '@hazeljs/core';
import {
  LocaleStore,
  TranslationMap,
  TranslationValue,
  TranslateOptions,
  ResolvedI18nOptions,
} from './types';

/**
 * The central translation and formatting service.
 *
 * Inject this service into any controller or provider to translate keys,
 * apply interpolation and pluralization, and format numbers / dates / currency
 * using the native Intl API — with zero external dependencies.
 */
@Service()
export class I18nService {
  /** Exposes Intl-based formatters as a nested namespace. */
  readonly format: I18nFormatter;

  private store: LocaleStore = new Map();
  private options!: ResolvedI18nOptions;

  constructor() {
    this.format = new I18nFormatter(this);
  }

  /**
   * Called by I18nModule after translations have been loaded from disk.
   */
  initialize(store: LocaleStore, options: ResolvedI18nOptions): void {
    this.store = store;
    this.options = options;
  }

  /**
   * Translate a dot-notation key for the given locale.
   *
   * @param key     Dot-separated translation key, e.g. "errors.notFound".
   * @param opts    Optional count (plural), vars (interpolation) and locale override.
   * @returns       The translated string, or the key itself if not found.
   *
   * @example
   * i18n.t('welcome', { vars: { name: 'Alice' } })
   * // → "Welcome, Alice!" (from en.json: { "welcome": "Welcome, {name}!" })
   *
   * i18n.t('items', { count: 3, vars: { count: '3' } })
   * // → "3 items" (from en.json: { "items": { "one": "1 item", "other": "{count} items" } })
   */
  t(key: string, opts: TranslateOptions = {}): string {
    const locale = opts.locale ?? this.getCurrentLocale();
    const raw = this.resolve(key, locale);
    if (raw === null) return key;

    const selected = this.selectPluralForm(raw, opts.count);
    return this.interpolate(selected, opts.vars);
  }

  /**
   * Returns the current request-scoped locale, falling back to the default.
   * When used with the LocaleMiddleware the locale is stored on the current
   * async context; outside a request context the default locale is used.
   */
  getCurrentLocale(): string {
    return this.options?.defaultLocale ?? 'en';
  }

  /**
   * Returns all translation keys available for a given locale (flattened to
   * dot-notation paths), useful for debugging and tooling.
   */
  getKeys(locale?: string): string[] {
    const targetLocale = locale ?? this.getCurrentLocale();
    const map = this.store.get(targetLocale);
    if (!map) return [];
    return this.flattenKeys(map);
  }

  /**
   * Returns all loaded locale codes.
   */
  getLocales(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Checks whether a key exists for the given locale.
   */
  has(key: string, locale?: string): boolean {
    return this.resolve(key, locale ?? this.getCurrentLocale()) !== null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Traverses the translation map using a dot-notation key.
   * Falls back to the fallbackLocale when the key is missing.
   */
  private resolve(key: string, locale: string): TranslationValue | null {
    const value = this.resolveInMap(key, this.store.get(locale));
    if (value !== null) return value;

    // Try the fallback locale
    const fallback = this.options?.fallbackLocale;
    if (fallback && fallback !== locale) {
      return this.resolveInMap(key, this.store.get(fallback));
    }

    return null;
  }

  private resolveInMap(key: string, map: TranslationMap | undefined): TranslationValue | null {
    if (!map) return null;

    const parts = key.split('.');
    let node: TranslationValue | undefined = map as TranslationValue;

    for (const part of parts) {
      if (node === null || node === undefined || typeof node !== 'object' || Array.isArray(node)) {
        return null;
      }
      const record = node as Record<string, TranslationValue>;
      node = record[part];
    }

    return node !== undefined ? node : null;
  }

  /**
   * Given a translation value that may be a plain string or a plural object,
   * returns the appropriate form.
   *
   * Uses the native Intl.PluralRules API, defaulting to "other" when
   * the value is not a plural object.
   */
  private selectPluralForm(value: TranslationValue, count?: number): string {
    if (typeof value === 'string') return value;

    if (typeof value === 'object' && ('one' in value || 'other' in value)) {
      const pluralObj = value as Record<string, string>;

      if (count === undefined) {
        return pluralObj['other'] ?? pluralObj['one'] ?? String(value);
      }

      const locale = this.getCurrentLocale();
      let rule: string;
      try {
        rule = new Intl.PluralRules(locale).select(count);
      } catch {
        rule = 'other';
      }

      return pluralObj[rule] ?? pluralObj['other'] ?? pluralObj['one'] ?? String(value);
    }

    // Nested object used as a namespace — return stringified (edge case)
    return JSON.stringify(value);
  }

  /**
   * Replaces {placeholder} tokens in a string with values from vars.
   */
  private interpolate(template: string, vars?: Record<string, string | number>): string {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
      const val = vars[key];
      return val !== undefined ? String(val) : `{${key}}`;
    });
  }

  private flattenKeys(map: TranslationMap, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [k, v] of Object.entries(map)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null && !('one' in v) && !('other' in v)) {
        keys.push(...this.flattenKeys(v as TranslationMap, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }
}

/**
 * Exposes Intl-backed formatters, accessible as `i18nService.format.*`.
 */
export class I18nFormatter {
  constructor(private readonly service: I18nService) {}

  /**
   * Format a number using Intl.NumberFormat.
   *
   * @example
   * i18n.format.number(1234567.89, 'de', { maximumFractionDigits: 2 })
   * // → "1.234.567,89"
   */
  number(value: number, locale?: string, opts?: Intl.NumberFormatOptions): string {
    const loc = locale ?? this.service.getCurrentLocale();
    return new Intl.NumberFormat(loc, opts).format(value);
  }

  /**
   * Format a date using Intl.DateTimeFormat.
   *
   * @example
   * i18n.format.date(new Date(), 'fr', { dateStyle: 'long' })
   * // → "4 mars 2026"
   */
  date(value: Date | number, locale?: string, opts?: Intl.DateTimeFormatOptions): string {
    const loc = locale ?? this.service.getCurrentLocale();
    return new Intl.DateTimeFormat(loc, opts).format(value);
  }

  /**
   * Format a monetary value using Intl.NumberFormat with style 'currency'.
   *
   * @example
   * i18n.format.currency(49.99, 'en', 'USD')
   * // → "$49.99"
   */
  currency(value: number, locale?: string, currency = 'USD'): string {
    const loc = locale ?? this.service.getCurrentLocale();
    return new Intl.NumberFormat(loc, { style: 'currency', currency }).format(value);
  }

  /**
   * Format a relative time using Intl.RelativeTimeFormat.
   *
   * @example
   * i18n.format.relative(-3, 'day', 'en')
   * // → "3 days ago"
   */
  relative(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    locale?: string,
    opts?: Intl.RelativeTimeFormatOptions
  ): string {
    const loc = locale ?? this.service.getCurrentLocale();
    return new Intl.RelativeTimeFormat(loc, opts).format(value, unit);
  }
}
