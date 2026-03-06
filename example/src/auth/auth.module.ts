import { HazelModule } from '@hazeljs/core';
import { JwtModule } from '@hazeljs/auth';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { JwtAuthGuard } from './jwt-auth.guard';

@HazelModule({
  imports: [
    UserModule,
    JwtModule.forRoot({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      expiresIn: '1h',
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
