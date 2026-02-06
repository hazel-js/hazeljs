import { HazelModule } from '@hazeljs/core';
import { JwtService, JwtServiceOptions } from './jwt.service';

export interface JwtModuleOptions extends JwtServiceOptions {}

@HazelModule({
  providers: [JwtService],
  exports: [JwtService],
})
export class JwtModule {
  static forRoot(options?: JwtModuleOptions): typeof JwtModule {
    if (options) {
      JwtService.configure(options);
    }
    return JwtModule;
  }
}
