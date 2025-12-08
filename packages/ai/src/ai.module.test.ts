import { AIModule } from './ai.module';
import { AIService } from './ai.service';
import { HazelApp } from '@hazeljs/core';

describe('AIModule', () => {
  it('should be defined', () => {
    expect(AIModule).toBeDefined();
  });

  it('should provide AIService', () => {
    const app = new HazelApp(AIModule);
    const container = app.getContainer();
    const aiService = container.resolve(AIService);
    expect(aiService).toBeInstanceOf(AIService);
  });

  it('should provide AIService as singleton', () => {
    const app = new HazelApp(AIModule);
    const container = app.getContainer();
    const service1 = container.resolve(AIService);
    const service2 = container.resolve(AIService);
    expect(service1).toBe(service2);
  });
});
