import { HazelModule } from '@hazeljs/core';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import type { OAuthModuleOptions } from './providers/provider.types';

@HazelModule({
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {
  static forRoot(options: OAuthModuleOptions): typeof OAuthModule {
    OAuthService.configure(options);
    return OAuthModule;
  }
}
