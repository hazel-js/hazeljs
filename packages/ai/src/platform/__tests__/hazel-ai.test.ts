import { HazelAI } from '../hazel-ai';
import { AIEnhancedService } from '../../ai-enhanced.service';
import type { HazelAIConfig } from '../hazel-ai.types';

// Mock all facades
jest.mock('../../facades/chat.facade');
jest.mock('../../facades/rag.facade');
jest.mock('../../facades/agent.facade');
jest.mock('../../facades/ml.facade');
jest.mock('../../facades/workflow.facade');
jest.mock('../../facades/assistant.facade');

// Mock AIEnhancedService
jest.mock('../../ai-enhanced.service');
const MockedAIEnhancedService = AIEnhancedService as jest.MockedClass<typeof AIEnhancedService>;

describe('HazelAI', () => {
  let hazelAI: HazelAI;
  let mockAIService: jest.Mocked<AIEnhancedService>;
  let config: HazelAIConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    config = {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 1000,
    };

    mockAIService = {
      complete: jest.fn(),
      streamComplete: jest.fn(),
      registerProvider: jest.fn(),
    } as any;

    MockedAIEnhancedService.mockImplementation(() => mockAIService as any);
    hazelAI = new HazelAI(config);
  });

  describe('create', () => {
    it('should create HazelAI instance with default config', () => {
      const instance = HazelAI.create();
      expect(instance).toBeInstanceOf(HazelAI);
    });

    it('should create HazelAI instance with custom config', () => {
      const customConfig: HazelAIConfig = {
        provider: 'anthropic',
        model: 'claude-sonnet-4',
      };
      const instance = HazelAI.create(customConfig);
      expect(instance).toBeInstanceOf(HazelAI);
    });
  });

  describe('chat', () => {
    it('should delegate to chat facade', async () => {
      const message = 'Hello, world!';
      const expectedResponse = 'Hi there!';

      // Mock the chat facade
      (hazelAI as any).chatFacade = {
        chat: jest.fn().mockResolvedValue(expectedResponse),
      };

      const result = await hazelAI.chat(message);

      expect((hazelAI as any).chatFacade.chat).toHaveBeenCalledWith(message, undefined);
      expect(result).toBe(expectedResponse);
    });

    it('should pass options to chat facade', async () => {
      const message = 'Test';
      const options = {
        provider: 'anthropic' as const,
        temperature: 0.5,
      };
      const expectedResponse = 'Response';

      (hazelAI as any).chatFacade = {
        chat: jest.fn().mockResolvedValue(expectedResponse),
      };

      await hazelAI.chat(message, options);

      expect((hazelAI as any).chatFacade.chat).toHaveBeenCalledWith(message, options);
    });
  });

  describe('stream', () => {
    it('should delegate to chat facade stream', async () => {
      const message = 'Stream test';
      const chunks = ['Hello', ' ', 'world'];

      const mockGenerator = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      (hazelAI as any).chatFacade = {
        stream: jest.fn().mockReturnValue(mockGenerator),
      };

      const result: string[] = [];
      for await (const chunk of hazelAI.stream(message)) {
        result.push(chunk);
      }

      expect((hazelAI as any).chatFacade.stream).toHaveBeenCalledWith(message, undefined);
      expect(result).toEqual(chunks);
    });
  });

  describe('rag', () => {
    it('should return RAG facade', () => {
      const mockRAGFacade = {
        ingest: jest.fn(),
        ask: jest.fn(),
        search: jest.fn(),
      };

      (hazelAI as any).ragFacade = mockRAGFacade;

      expect(hazelAI.rag).toBe(mockRAGFacade);
    });
  });

  describe('agent', () => {
    it('should delegate to agent facade', async () => {
      const name = 'TestAgent';
      const input = 'Test input';
      const options = { option1: 'value1' };
      const expectedResult = { response: 'Agent response' };

      (hazelAI as any).agentFacade = {
        execute: jest.fn().mockResolvedValue(expectedResult),
      };

      const result = await hazelAI.agent(name, input, options);

      expect((hazelAI as any).agentFacade.execute).toHaveBeenCalledWith(name, input, options);
      expect(result).toBe(expectedResult);
    });
  });

  describe('pipeline', () => {
    it('should delegate to agent facade', () => {
      const id = 'test-pipeline';
      const agents = ['Agent1', 'Agent2'];
      const expectedPipeline = { execute: jest.fn() };

      (hazelAI as any).agentFacade = {
        pipeline: jest.fn().mockReturnValue(expectedPipeline),
      };

      const result = hazelAI.pipeline(id, agents);

      expect((hazelAI as any).agentFacade.pipeline).toHaveBeenCalledWith(id, agents);
      expect(result).toBe(expectedPipeline);
    });
  });

  describe('classify', () => {
    it('should delegate to ML facade', async () => {
      const text = 'Test text';
      const options = {
        labels: ['positive', 'negative'],
      };
      const expectedResult = {
        label: 'positive',
        confidence: 0.95,
      };

      (hazelAI as any).mlFacade = {
        classify: jest.fn().mockResolvedValue(expectedResult),
      };

      const result = await hazelAI.classify(text, options);

      expect((hazelAI as any).mlFacade.classify).toHaveBeenCalledWith(text, options);
      expect(result).toBe(expectedResult);
    });
  });

  describe('sentiment', () => {
    it('should delegate to ML facade', async () => {
      const text = 'Great product!';
      const expectedResult = {
        sentiment: 'positive' as const,
        score: 0.98,
      };

      (hazelAI as any).mlFacade = {
        sentiment: jest.fn().mockResolvedValue(expectedResult),
      };

      const result = await hazelAI.sentiment(text);

      expect((hazelAI as any).mlFacade.sentiment).toHaveBeenCalledWith(text);
      expect(result).toBe(expectedResult);
    });
  });

  describe('score', () => {
    it('should delegate to ML facade', async () => {
      const prompt = 'Rate relevance';
      const options = {
        items: [{ id: '1', text: 'Test' }],
        criteria: 'test criteria',
      };
      const expectedResult = [{ id: '1', score: 0.9 }];

      (hazelAI as any).mlFacade = {
        score: jest.fn().mockResolvedValue(expectedResult),
      };

      const result = await hazelAI.score(prompt, options);

      expect((hazelAI as any).mlFacade.score).toHaveBeenCalledWith(prompt, options);
      expect(result).toBe(expectedResult);
    });
  });

  describe('workflow', () => {
    it('should delegate to workflow facade', () => {
      const id = 'test-workflow';
      const expectedBuilder = {
        step: jest.fn(),
        run: jest.fn(),
      };

      (hazelAI as any).workflowFacade = {
        create: jest.fn().mockReturnValue(expectedBuilder),
      };

      const result = hazelAI.workflow(id);

      expect((hazelAI as any).workflowFacade.create).toHaveBeenCalledWith(id);
      expect(result).toBe(expectedBuilder);
    });
  });

  describe('assistant', () => {
    it('should delegate to assistant facade', () => {
      const assistantConfig = {
        name: 'Test Assistant',
        systemPrompt: 'You are helpful',
      };
      const expectedAssistant = {
        chat: jest.fn(),
        getHistory: jest.fn(),
        clearHistory: jest.fn(),
        sessionId: 'test-session',
      };

      (hazelAI as any).assistantFacade = {
        create: jest.fn().mockReturnValue(expectedAssistant),
      };

      const result = hazelAI.assistant(assistantConfig);

      expect((hazelAI as any).assistantFacade.create).toHaveBeenCalledWith(assistantConfig);
      expect(result).toBe(expectedAssistant);
    });
  });

  describe('registerProvider', () => {
    it('should delegate to AI service', () => {
      const mockProvider = {
        name: 'openai' as const,
        complete: jest.fn(),
        streamComplete: jest.fn(),
        embed: jest.fn(),
        isAvailable: jest.fn(),
      };

      hazelAI.registerProvider(mockProvider);

      expect(mockAIService.registerProvider).toHaveBeenCalledWith(mockProvider);
    });
  });

  describe('getMetrics', () => {
    it('should return empty metrics for now', () => {
      const metrics = hazelAI.getMetrics();

      expect(metrics).toEqual({
        totalRequests: 0,
        totalTokens: 0,
        averageLatencyMs: 0,
        errorRate: 0,
        costEstimate: 0,
        byProvider: {},
      });
    });
  });
});
