export { AbilityFactory } from './ability.factory';
export { CaslService } from './casl.service';
export { CaslModule } from './casl.module';
export type { CaslModuleOptions } from './casl.module';
export { PoliciesGuard } from './policy.guard';
export { CheckPolicies } from './decorators/check-policies.decorator';
export { Ability } from './decorators/ability.decorator';
export type { PolicyHandler, IPolicyHandler, AnyPolicyHandler } from './types';

// Re-export the most commonly used @casl/ability symbols so applications
// that depend only on @hazeljs/casl do not need @casl/ability as a direct
// dependency in their own package.json.
export { AbilityBuilder, createMongoAbility, subject } from '@casl/ability';
export type { MongoAbility, AnyAbility } from '@casl/ability';
