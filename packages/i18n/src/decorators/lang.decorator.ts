import 'reflect-metadata';
import { LOCALE_KEY } from '../i18n.middleware';

const INJECT_METADATA_KEY = 'hazel:inject';

/**
 * Parameter decorator that injects the detected locale string into a
 * controller method parameter.
 *
 * The locale is set by LocaleMiddleware earlier in the request lifecycle.
 * When the middleware is not applied, the parameter will be `undefined`.
 *
 * @example
 * ```ts
 * @Get('/hello')
 * greet(@Lang() locale: string) {
 *   return this.i18n.t('welcome', { locale });
 * }
 * ```
 */
export function Lang(): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('@Lang() must be used on a method parameter');
    }

    const constructor = (target as { constructor: new (...args: unknown[]) => object }).constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) ?? [];
    injections[parameterIndex] = { type: 'custom', key: LOCALE_KEY, source: 'request' };
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
  };
}

/**
 * Reads the locale injected by @Lang() from the raw request object.
 * Exposed for use in custom parameter resolvers.
 */
export function extractLang(req: Record<string, unknown>): string | undefined {
  return req[LOCALE_KEY] as string | undefined;
}
