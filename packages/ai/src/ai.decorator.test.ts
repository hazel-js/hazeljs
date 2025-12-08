import { AITask } from './ai.decorator';
import { AIService } from './ai.service';
import { Container } from '@hazeljs/core';
import { AITaskConfig } from './ai.types';
import { Injectable } from '@hazeljs/core';

// Mock the AIService
jest.mock('./ai.service', () => {
  const mockAIService = jest.fn().mockImplementation(() => ({
    executeTask: jest.fn().mockImplementation(async (config: AITaskConfig, input: unknown) => ({
      data: `Processed: ${input}`,
    })),
  }));
  return {
    AIService: mockAIService,
  };
});

describe('AITask Decorator', () => {
  let container: Container;
  let mockAIService: AIService;

  beforeEach(() => {
    container = Container.getInstance();
    container.clear();
    // Create a mock instance
    mockAIService = new AIService();
    // Register AIService with the mock instance
    container.register(AIService, mockAIService);
  });

  afterEach(() => {
    container.clear();
    jest.clearAllMocks();
  });

  it('should inject AIService', (): void => {
    @Injectable()
    class TestClass {
      constructor(public aiService: AIService) {}

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

    // Register the test class
    container.register(TestClass, new TestClass(mockAIService));
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
        public aiService: AIService,
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

    // Register both services
    const otherService = new OtherService();
    container.register(OtherService, otherService);
    container.register(TestClass, new TestClass(mockAIService, otherService));

    const instance = container.resolve(TestClass);
    expect(instance.aiService).toBeDefined();
    expect(instance.aiService).toBe(mockAIService);
    expect(instance.otherService).toBeDefined();
    expect(instance.otherService).toBe(otherService);
  });

  it('should throw error if AIService is not registered', async (): Promise<void> => {
    @Injectable()
    class TestClass {
      constructor(public aiService: AIService) {}

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
    // Don't register AIService
    const instance = new TestClass(null as unknown as AIService);
    container.register(TestClass, instance);
    const resolved = container.resolve(TestClass);

    // The error should be thrown when trying to execute the decorated method
    await expect(resolved.testMethod('test')).rejects.toThrow(
      'AI task execution failed: AI service not found. Make sure to inject AIService in the constructor.'
    );
  });

  it('should execute AI task', async () => {
    @Injectable()
    class TestClass {
      constructor(public aiService: AIService) {}

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

    // Register the test class with AIService
    container.register(TestClass, new TestClass(mockAIService));
    const instance = container.resolve(TestClass);
    const result = await instance.testMethod('test input');
    expect(result).toBeDefined();
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
