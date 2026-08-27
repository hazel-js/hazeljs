import 'reflect-metadata';

const INJECT_METADATA_KEY = 'hazel:inject';

/**
 * Parameter decorator that injects the authenticated user from the request
 * context into a controller method parameter.
 *
 * Requires JwtAuthGuard (or any guard that sets `req.user`) to run before
 * the route handler. The value injected is the `AuthUser` object attached
 * by the guard.
 *
 * @example
 * ```ts
 * @UseGuards(JwtAuthGuard)
 * @Get('/profile')
 * getProfile(@CurrentUser() user: AuthUser) {
 *   return user;
 * }
 *
 * // Access a specific field:
 * @Get('/me')
 * whoAmI(@CurrentUser('role') role: string) {
 *   return { role };
 * }
 * ```
 */
export function CurrentUser(field?: string): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('@CurrentUser() must be used on a method parameter');
    }

    const constructor = (target as { constructor: new (...args: unknown[]) => object }).constructor;
    const injections = Reflect.getMetadata(INJECT_METADATA_KEY, constructor, propertyKey) ?? [];
    injections[parameterIndex] = { type: 'user', field };
    Reflect.defineMetadata(INJECT_METADATA_KEY, injections, constructor, propertyKey);
  };
}
