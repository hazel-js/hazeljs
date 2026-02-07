import { HazelModule } from '@hazeljs/core';
import { JwtService, JwtServiceOptions } from './jwt.service';

@HazelModule({
  providers: [JwtService],
  exports: [JwtService],
})
export class JwtModule {
  static forRoot(options?: JwtServiceOptions): typeof JwtModule {
    if (options) {
      JwtService.configure(options);
    }
    return JwtModule;
  }
}
