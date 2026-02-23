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
import { KnowledgeBaseAgentModule } from './agent/knowledge-base-agent.module';
import { PdfToAudioModule } from '@hazeljs/pdf-to-audio';

@HazelModule({
  imports: [
    // PDF-to-Audio with Redis queue (requires Redis running)
    PdfToAudioModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
      outputDir: process.env.PDF_TO_AUDIO_OUTPUT_DIR || './data/pdf-to-audio',
    }) as any,
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
    KnowledgeBaseAgentModule,
    SwaggerModule,
  ],
  providers: [ValidationPipe],
})
export class AppModule {}
