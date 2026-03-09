import { HazelModule } from '@hazeljs/core';
import { FeatureToggleService } from './feature-toggle.service';
import type { FeatureToggleModuleOptions } from './feature-toggle.types';

export type { FeatureToggleModuleOptions } from './feature-toggle.types';

@HazelModule({
  providers: [FeatureToggleService],
  exports: [FeatureToggleService],
})
export class FeatureToggleModule {
  /**
   * Register FeatureToggleModule with optional options.
   */
  static forRoot(options?: FeatureToggleModuleOptions): typeof FeatureToggleModule {
    if (options) {
      FeatureToggleService.setOptions(options);
    }
    return FeatureToggleModule;
  }
}
