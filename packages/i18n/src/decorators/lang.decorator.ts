import 'reflect-metadata';
import { LOCALE_KEY } from '../i18n.middleware';

const INJECT_METADATA_KEY = 'hazel:inject';

/**
 * Internal query key used to pass the resolved locale through the HazelJS
 * request context so the router can inject it via @Lang().
 *
 * The proxy handler in main.ts writes this key into context.query before
 * route matching; @Lang() reads it back using the standard 'query' injection
 * type that the router already handles.
 */
export const LANG_QUERY_KEY = '__hazel_i18n_locale__';

/**
 * Parameter decorator that injects the detected locale string into a
 * controller method parameter.
 *
 * Requires LocaleMiddleware (via addProxyHandler) to run before routing so
 * the locale is resolved and stored in context.query[LANG_QUERY_KEY].
 * When the middleware is not applied, the parameter will be undefined.
 *
 * @example
 * ```ts
 * @Get('/hello')
 * greet(@Lang() locale: string) {
 *   return this.i18n.t('welcome', { locale, vars: { name: 'World' } });
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
    // Use the router's built-in 'query' injection — the proxy handler seeds
    // context.query[LANG_QUERY_KEY] with the detected locale before routing.
    injections[parameterIndex] = { type: 'query', name: LANG_QUERY_KEY };
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
  };
}

/**
 * Reads the locale injected by LocaleMiddleware from the raw request object.
 * Useful outside of controller parameters (e.g. in exception filters).
 */
export function extractLang(req: Record<string, unknown>): string | undefined {
  return req[LOCALE_KEY] as string | undefined;
}
