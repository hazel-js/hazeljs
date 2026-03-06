import { HazelModule } from '@hazeljs/core';
import type { AnyAbility } from '@casl/ability';
import { AbilityFactory } from './ability.factory';
import { CaslService } from './casl.service';

export interface CaslModuleOptions<A extends AnyAbility = AnyAbility> {
  /**
   * Your application's ability factory class.  It must extend `AbilityFactory`
   * and be decorated with `@Injectable()` so the DI container can resolve it.
   *
   * @example
   * ```ts
   * CaslModule.forRoot({ abilityFactory: AppAbilityFactory })
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abilityFactory: new (...args: any[]) => AbilityFactory<A>;
}

/**
 * HazelJS module that wires attribute-level authorization into your app.
 *
 * Register once in your root module:
 *
 * ```ts
 * @HazelModule({
 *   imports: [
 *     CaslModule.forRoot({ abilityFactory: AppAbilityFactory }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * Then use `PoliciesGuard` / `@CheckPolicies` on your routes and inject
 * `CaslService` in your services for record-level checks.
 */
@HazelModule({
  providers: [CaslService],
  exports: [CaslService],
})
export class CaslModule {
  static forRoot<A extends AnyAbility>(options: CaslModuleOptions<A>): typeof CaslModule {
    CaslService.configure(options.abilityFactory);
    return CaslModule;
  }
}
