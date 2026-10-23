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
import { ContextController } from './context/context.controller';

// Import agent classes BEFORE AgentModule so @Agent decorators register first
import { AgentController, WeatherAgent } from './agent/agent.controller';
import { TravelController, TravelAgent, FactsAgent } from './agent/travel.controller';
import { DeskController, SupportDeskAgent } from './agent/desk.controller';

@HazelModule({
  imports: [
    InspectorModule.forRoot({
      inspectorBasePath: '/__hazel',
      developmentOnly: true,
    }) as any,
    ConfigModule.forRoot({
      envFilePath: ['.env', '.env.local'],
      isGlobal: true,
    }) as any,
    CacheModule.forRoot({
      strategy: 'memory',
      isGlobal: true,
    }) as any,
    AIModule,
    RAGModule,
    AgentModule.forRoot() as any,
  ],
  controllers: [
    ChatController,
    RAGController,
    HealthController,
    AgentController,
    TravelController,
    ContextController,
    DeskController,
  ],
  providers: [WeatherAgent, TravelAgent, FactsAgent, SupportDeskAgent],
})
export class AppModule {}
