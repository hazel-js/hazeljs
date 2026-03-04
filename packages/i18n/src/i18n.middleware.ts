import { Request, Response } from '@hazeljs/core';
import { ResolvedI18nOptions } from './types';

/**
 * Symbol used to attach the detected locale to the request object so that
 * downstream handlers and the @Lang() decorator can read it.
 */
export const LOCALE_KEY = '__hazel_locale__';

/**
 * Middleware that detects the request locale and stores it on the request
 * object.  Detection is attempted in the order specified by
 * I18nOptions.detection (default: query → cookie → header).
 *
 * Usage — register on the HazelApp before route handling:
 *
 * ```ts
 * const localeMiddleware = new LocaleMiddleware(options);
 * app.use((req, res, next) => localeMiddleware.handle(req, res, next));
 * ```
 */
export class LocaleMiddleware {
  constructor(private readonly options: ResolvedI18nOptions) {}

  handle(req: Request, res: Response, next: () => void): void {
    const locale = this.detect(req);
    (req as Record<string, unknown>)[LOCALE_KEY] = locale;
    // Expose the detected locale as a response header so clients can confirm.
    res.setHeader('Content-Language', locale);
    next();
  }

  /**
   * Run through each configured strategy in priority order and return the
   * first valid locale found, or the default locale as a fallback.
   */
  private detect(req: Request): string {
    for (const strategy of this.options.detection) {
      switch (strategy) {
        case 'query': {
          const lang = req.query?.[this.options.queryParam];
          if (lang && this.isValid(lang)) return lang;
          break;
        }
        case 'cookie': {
          const cookieLocale = this.parseCookie(req, this.options.cookieName);
          if (cookieLocale && this.isValid(cookieLocale)) return cookieLocale;
          break;
        }
        case 'header': {
          const headerLocale = this.parseAcceptLanguage(req);
          if (headerLocale && this.isValid(headerLocale)) return headerLocale;
          break;
        }
      }
    }

    return this.options.defaultLocale;
  }

  /**
   * Parse the Cookie header and extract the value for the given name.
   */
  private parseCookie(req: Request, name: string): string | undefined {
    const cookieHeader = req.headers?.['cookie'] ?? req.headers?.['Cookie'];
    if (!cookieHeader) return undefined;

    for (const pair of cookieHeader.split(';')) {
      const [key, ...rest] = pair.trim().split('=');
      if (key?.trim() === name) {
        return decodeURIComponent(rest.join('=').trim());
      }
    }

    return undefined;
  }

  /**
   * Parse the Accept-Language header and return the highest-priority locale
   * that looks like a valid BCP-47 tag.
   *
   * Example: "fr-FR,fr;q=0.9,en;q=0.8" → "fr-FR"
   */
  private parseAcceptLanguage(req: Request): string | undefined {
    const header = req.headers?.['accept-language'] ?? req.headers?.['Accept-Language'];
    if (!header) return undefined;

    // Parse and sort by q-value, then return the first locale code.
    const locales = header
      .split(',')
      .map((entry) => {
        const [locale, q] = entry.trim().split(';q=');
        return { locale: locale.trim(), q: q ? parseFloat(q) : 1.0 };
      })
      .sort((a, b) => b.q - a.q)
      .map((entry) => entry.locale);

    return locales[0];
  }

  /**
   * A locale is "valid" if it looks like a non-empty BCP-47 tag
   * (letters, digits, hyphens, underscores).
   */
  private isValid(locale: string): boolean {
    return /^[a-zA-Z]{2,8}([-_][a-zA-Z0-9]{2,8})*$/.test(locale);
  }

  /**
   * Factory method for use with HazelApp.use() or route-level middleware.
   */
  static create(
    options: ResolvedI18nOptions
  ): (req: Request, res: Response, next: () => void) => void {
    const mw = new LocaleMiddleware(options);
    return (req, res, next) => mw.handle(req, res, next);
  }
}

/**
 * Reads the locale that was attached to the request by LocaleMiddleware.
 * Returns undefined if the middleware was not applied.
 */
export function getLocaleFromRequest(req: Request): string | undefined {
  return (req as Record<string, unknown>)[LOCALE_KEY] as string | undefined;
}
