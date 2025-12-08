import { HazelModule } from '@hazeljs/core';
import { AIService } from './ai.service';

@HazelModule({
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {
  static register(_options: { provider: string; model: string; apiKey: string }): typeof AIModule {
    return AIModule;
  }
}
