import { AITask } from './ai.decorator';
import { AIEnhancedService } from './ai-enhanced.service';
import { Container } from '@hazeljs/core';
import { Injectable } from '@hazeljs/core';

describe('AITask Decorator', () => {
  let container: Container;
  let mockAIService: Pick<AIEnhancedService, 'executeTask'>;

  beforeEach(() => {
    container = Container.getInstance();
    container.clear();
    mockAIService = {
      executeTask: jest.fn().mockImplementation(async (_config, input: unknown) => ({
        data: `Processed: ${input}`,
      })),
    };
    container.register(AIEnhancedService, mockAIService as AIEnhancedService);
  });

  afterEach(() => {
    container.clear();
    jest.clearAllMocks();
  });

  it('should inject AIEnhancedService', (): void => {
    @Injectable()
    class TestClass {
      constructor(public aiService: AIEnhancedService) {}

      @AITask({
        name: 'test-task',
        prompt: 'Test prompt',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        outputType: 'string',
      })
      async testMethod(input: string): Promise<string> {
        return input;
      }
    }

    container.register(TestClass, new TestClass(mockAIService as AIEnhancedService));
    const instance = container.resolve(TestClass);
    expect(instance.aiService).toBeDefined();
    expect(instance.aiService).toBe(mockAIService);
  });

  it('should work with multiple dependencies', (): void => {
    @Injectable()
    class OtherService {}

    @Injectable()
    class TestClass {
      constructor(
        public aiService: AIEnhancedService,
        public otherService: OtherService
      ) {}

      @AITask({
        name: 'test-task',
        prompt: 'Test prompt',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        outputType: 'string',
      })
      async testMethod(input: string): Promise<string> {
        return input;
      }
    }

    const otherService = new OtherService();
    container.register(OtherService, otherService);
    container.register(
      TestClass,
      new TestClass(mockAIService as AIEnhancedService, otherService)
    );

    const instance = container.resolve(TestClass);
    expect(instance.aiService).toBe(mockAIService);
    expect(instance.otherService).toBe(otherService);
  });

  it('should throw error if AIEnhancedService is not registered', async (): Promise<void> => {
    @Injectable()
    class TestClass {
      constructor(public aiService: AIEnhancedService) {}

      @AITask({
        name: 'test-task',
        prompt: 'Test prompt',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        outputType: 'string',
      })
      async testMethod(input: string): Promise<string> {
        return input;
      }
    }

    container.clear();
    const instance = new TestClass(null as unknown as AIEnhancedService);
    container.register(TestClass, instance);
    const resolved = container.resolve(TestClass);

    await expect(resolved.testMethod('test')).rejects.toThrow(
      'AI task execution failed: AI service not found. Make sure to inject AIEnhancedService in the constructor.'
    );
  });

  it('should execute AI task', async () => {
    @Injectable()
    class TestClass {
      constructor(public aiService: AIEnhancedService) {}

      @AITask({
        name: 'test-task',
        prompt: 'Test prompt',
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        outputType: 'string',
      })
      async testMethod(input: string): Promise<string> {
        return input;
      }
    }

    container.register(TestClass, new TestClass(mockAIService as AIEnhancedService));
    const instance = container.resolve(TestClass);
    const result = await instance.testMethod('test input');
    expect(result).toBe('Processed: test input');
    expect(mockAIService.executeTask).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-task',
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        prompt: 'Test prompt',
        outputType: 'string',
      }),
      'test input'
    );
  });
});
