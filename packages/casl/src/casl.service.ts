import { Injectable, Container, type InjectionToken } from '@hazeljs/core';
import type { AnyAbility } from '@casl/ability';
import { AbilityFactory } from './ability.factory';

/**
 * Core service that builds a CASL ability for a given user.
 *
 * Inject this service anywhere you need record-level authorization:
 *
 * @example
 * ```ts
 * @Injectable()
 * export class PostsService {
 *   constructor(private readonly casl: CaslService<AppAbility>) {}
 *
 *   async update(user: AuthUser, postId: string, dto: UpdatePostDto) {
 *     const post  = await this.postsRepo.findById(postId);
 *     const ability = this.casl.createForUser(user);
 *     if (!ability.can('update', post)) {
 *       throw Object.assign(new Error('Forbidden'), { status: 403 });
 *     }
 *     return this.postsRepo.update(postId, dto);
 *   }
 * }
 * ```
 */
@Injectable()
export class CaslService<A extends AnyAbility = AnyAbility> {
  // Resolved lazily so the factory class is available after DI wires everything up.
  private get factory(): AbilityFactory<A> {
    const factoryClass = CaslService.factoryClass;
    if (!factoryClass) {
      throw new Error(
        'CaslService: no AbilityFactory registered. ' +
          'Call CaslModule.forRoot({ abilityFactory: YourFactory }) in your app module.'
      );
    }
    return Container.getInstance().resolve(factoryClass as InjectionToken<AbilityFactory<A>>);
  }

  /**
   * Build an ability instance for the given user object.
   * The user value comes from `req.user` (set by JwtAuthGuard or your own guard).
   */
  createForUser(user: Record<string, unknown>): A {
    return this.factory.createForUser(user);
  }

  // ---------------------------------------------------------------------------
  // Static configuration — set once by CaslModule.forRoot()
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static factoryClass: (new (...args: any[]) => AbilityFactory<AnyAbility>) | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static configure(factoryClass: new (...args: any[]) => AbilityFactory<AnyAbility>): void {
    CaslService.factoryClass = factoryClass;
  }
}
