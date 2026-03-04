import { Interceptor } from '@hazeljs/core';
import { RequestContext } from '@hazeljs/core';
import { I18nService } from './i18n.service';
import { LOCALE_KEY } from './i18n.middleware';

/**
 * Shape of a translated response body that the interceptor can process.
 * Any response body matching this shape will have its `message` field
 * replaced with its translated equivalent.
 */
interface TranslatableResponse {
  message?: string;
  [key: string]: unknown;
}

/**
 * Optional interceptor that automatically translates a `message` field found
 * in the response object.
 *
 * The `message` value is treated as an i18n key.  If the key exists in the
 * translation store for the request locale, it is replaced in-place; otherwise
 * the original value is preserved.
 *
 * Register it per-controller with @UseInterceptors(I18nInterceptor) or
 * globally via the HazelApp interceptor API.
 *
 * @example
 * // Returning from a controller:
 * return { message: 'user.created', data: user };
 * // → { message: 'User created successfully.', data: user }  (if key exists)
 */
export class I18nInterceptor implements Interceptor {
  constructor(private readonly i18n: I18nService) {}

  async intercept(context: RequestContext, next: () => Promise<unknown>): Promise<unknown> {
    const result = await next();

    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return result;
    }

    const body = result as TranslatableResponse;
    if (typeof body.message !== 'string') {
      return result;
    }

    const locale = this.extractLocale(context);
    const translated = this.i18n.t(body.message, { locale });

    // Only substitute when a real translation was found (key !== translated).
    if (translated !== body.message) {
      return { ...body, message: translated };
    }

    return result;
  }

  /**
   * Reads the locale attached by LocaleMiddleware from the raw request object.
   */
  private extractLocale(context: RequestContext): string | undefined {
    const req = context.req ?? (context as unknown as Record<string, unknown>)['request'];
    if (!req || typeof req !== 'object') return undefined;
    return (req as Record<string, unknown>)[LOCALE_KEY] as string | undefined;
  }
}
