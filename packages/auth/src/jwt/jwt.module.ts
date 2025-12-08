import { HazelModule } from '@hazeljs/core';
import { JwtService } from './jwt.service';

export interface JwtModuleOptions {
  secret: string;
  signOptions?: {
    expiresIn?: string;
  };
}

@HazelModule({
  providers: [JwtService],
  exports: [JwtService],
})
export class JwtModule {
  static forRoot(_options?: unknown): typeof JwtModule {
    return JwtModule;
  }
}
