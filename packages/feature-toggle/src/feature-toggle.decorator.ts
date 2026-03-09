import { UseGuards } from '@hazeljs/core';
import { createFeatureToggleGuard } from './feature-toggle.guard';

/**
 * Protects a controller or route handler with a feature flag. When the flag is
 * disabled, requests receive 403 without executing the handler.
 *
 * @param featureName - The feature flag name (must be enabled for access).
 * @example
 * @FeatureToggle('newCheckout')
 * @Get('new')
 * getNewCheckout() { ... }
 *
 * @FeatureToggle('betaApi')
 * @Controller('beta')
 * export class BetaController { ... }
 */
export function FeatureToggle(featureName: string): MethodDecorator & ClassDecorator {
  const GuardClass = createFeatureToggleGuard(featureName);
  return UseGuards(GuardClass);
}
