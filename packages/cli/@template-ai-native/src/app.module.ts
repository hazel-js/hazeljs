import { HazelModule } from '@hazeljs/core';
import { InspectorModule } from '@hazeljs/inspector';
import { AIModule } from '@hazeljs/ai';
import { AgentModule } from '@hazeljs/agent';
import { RAGModule } from '@hazeljs/rag';
import { ConfigModule } from '@hazeljs/config';
import { CacheModule } from '@hazeljs/cache';
import { ChatController } from './ai/chat.controller';
import { RAGController } from './rag/rag.controller';
import { HealthController } from './health.controller';

// Import agent classes BEFORE AgentModule to ensure @Agent decorators run first
import { AgentController, WeatherAgent } from './agent/agent.controller';
import { TravelController, TravelAgent, FactsAgent } from './agent/travel.controller';

@HazelModule({
  imports: [
    // Inspector - dev tools at /__hazel
    InspectorModule.forRoot({
      inspectorBasePath: '/__hazel',
      developmentOnly: true,
    }) as any,
    // Configuration module
    ConfigModule.forRoot({
      envFilePath: ['.env', '.env.local'],
      isGlobal: true,
    }) as any,
    // Cache Module
    CacheModule.forRoot({
      strategy: 'memory',
      isGlobal: true,
    }) as any,
    // AI Module with OpenAI provider (must come before AgentModule)
    AIModule,
    // RAG Module
    RAGModule,
    // Agent Module - auto-discovers @Agent decorated classes
    // LLM provider is auto-configured from AIEnhancedService (via AIModule)
    AgentModule.forRoot() as any,
  ],
  controllers: [ChatController, RAGController, HealthController, AgentController, TravelController],
  providers: [WeatherAgent, TravelAgent, FactsAgent],
})
export class AppModule {}
