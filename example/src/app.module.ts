import { HazelModule, ValidationPipe } from '@hazeljs/core';
import { PrismaModule } from '@hazeljs/prisma';
import { ConfigModule } from '@hazeljs/config';
import { CacheModule } from '@hazeljs/cache';
import { SwaggerModule } from '@hazeljs/swagger';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { AIModule } from './ai/ai.module';
import { DemoModule } from './demo/demo.module';
import { ServerlessModule } from './serverless/serverless.module';
import { CacheExampleModule } from './cache/cache-example.module';

@HazelModule({
  imports: [
    // Configuration module with validation
    ConfigModule.forRoot({
      envFilePath: ['.env', '.env.local'],
      isGlobal: true,
    }) as any,
    // Cache module with memory strategy
    CacheModule.forRoot({
      strategy: 'memory',
      isGlobal: true,
    }) as any,
    PrismaModule,
    UserModule,
    AuthModule,
    AIModule,
    DemoModule,
    ServerlessModule,
    CacheExampleModule,
    SwaggerModule,
  ],
  providers: [ValidationPipe],
})
export class AppModule {}
