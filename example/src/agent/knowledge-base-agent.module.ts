import { HazelModule } from '@hazeljs/core';
import { AIModule } from '@hazeljs/ai';
import { AgentModule } from '@hazeljs/agent';
import { KnowledgeBaseController } from './knowledge-base-agent.example';
import { KnowledgeBaseService } from './knowledge-base-agent.example';

@HazelModule({
  imports: [
    AIModule,
    AgentModule.forRoot({
      agents: [],
    }) as any,
  ],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseAgentModule {}
