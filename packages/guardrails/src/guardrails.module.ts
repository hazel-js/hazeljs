/**
 * GuardrailsModule - Content safety for AI applications
 */

import { HazelModule, type Provider } from '@hazeljs/core';
import { GuardrailsService } from './guardrails.service';
import { GuardrailPipe } from './pipes/guardrail.pipe';
import { GuardrailInterceptor } from './interceptors/guardrail.interceptor';
import type { GuardrailsModuleOptions } from './guardrails.types';

/** Token for optional injection (e.g. in @hazeljs/agent) */
export const GUARDRAILS_SERVICE_TOKEN = 'GuardrailsService';

const guardrailsServiceProvider: Provider = {
  token: GUARDRAILS_SERVICE_TOKEN,
  useClass: GuardrailsService,
};

@HazelModule({
  providers: [
    GuardrailsService,
    GuardrailPipe,
    GuardrailInterceptor,
    guardrailsServiceProvider,
  ] as unknown as (typeof GuardrailsService)[],
  exports: [GuardrailsService, GuardrailPipe, GuardrailInterceptor],
})
export class GuardrailsModule {
  private static options: GuardrailsModuleOptions = {};

  static forRoot(options?: GuardrailsModuleOptions): typeof GuardrailsModule {
    GuardrailsModule.options = options ?? {};
    if (options) {
      GuardrailsService.configure(options);
    }
    return GuardrailsModule;
  }

  static getOptions(): GuardrailsModuleOptions {
    return GuardrailsModule.options;
  }
}
