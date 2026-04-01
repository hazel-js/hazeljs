import { AgentFacade } from '../agent.facade';
import { AIEnhancedService } from '../../ai-enhanced.service';
import type { HazelAIConfig } from '../../platform/hazel-ai.types';

// Error variable for testing - must be declared before jest.mock
let mockAgentError: Error | null = null;

// Mock the @hazeljs/agent package with error control
jest.mock('@hazeljs/agent', () => {
  if (mockAgentError) {
    throw mockAgentError;
  }
  return {
    AgentService: jest.fn().mockImplementation(() => ({
      execute: jest.fn(),
      pipeline: jest.fn(),
    })),
  };
});

describe('AgentFacade', () => {
  let facade: AgentFacade;
  let mockAIService: jest.Mocked<AIEnhancedService>;
  let mockConfig: HazelAIConfig;

  afterEach(() => {
    mockAgentError = null;
  });

  beforeEach(() => {
    mockAIService = {
      complete: jest.fn(),
      streamComplete: jest.fn(),
    } as any;

    mockConfig = {
      defaultProvider: 'openai',
    };

    facade = new AgentFacade(mockAIService, mockConfig);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create AgentFacade with dependencies', () => {
      expect(facade).toBeInstanceOf(AgentFacade);
    });

    it('should initialize with unresolved state', () => {
      expect((facade as any).resolved).toBe(false);
      expect((facade as any).agentService).toBeNull();
    });
  });

  describe('ensureAgent', () => {
    it('should load agent service successfully', async () => {
      await (facade as any).ensureAgent();

      expect((facade as any).resolved).toBe(true);
      expect((facade as any).agentService).toBeDefined();
    });

    it('should not load agent service multiple times', async () => {
      const { AgentService } = await import('@hazeljs/agent');

      await (facade as any).ensureAgent();
      await (facade as any).ensureAgent();

      expect(AgentService).toHaveBeenCalledTimes(1);
    });

    it('should throw helpful error when @hazeljs/agent is not installed', async () => {
      mockAgentError = new Error('Cannot find module "@hazeljs/agent"');
      jest.resetModules();

      const newFacade = new AgentFacade(mockAIService, mockConfig);

      await expect((newFacade as any).ensureAgent()).rejects.toThrow(
        '@hazeljs/agent is required for agent features. Install it:\n  npm install @hazeljs/agent'
      );

      mockAgentError = null;
    });

    it('should rethrow non-module-not-found errors', async () => {
      mockAgentError = new Error('Some other error');
      jest.resetModules();

      const newFacade = new AgentFacade(mockAIService, mockConfig);

      await expect((newFacade as any).ensureAgent()).rejects.toThrow('Some other error');

      mockAgentError = null;
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      await (facade as any).ensureAgent();
    });

    it('should execute agent with name and input', async () => {
      const mockResult = { response: 'Test response', usage: { tokens: 10 } };
      const mockAgentService = (facade as any).agentService;
      mockAgentService.execute.mockResolvedValue(mockResult);

      const result = await facade.execute('test-agent', 'Hello world');

      expect(mockAgentService.execute).toHaveBeenCalledWith('test-agent', 'Hello world', undefined);
      expect(result).toEqual(mockResult);
    });

    it('should execute agent with options', async () => {
      const mockResult = { response: 'Test response', usage: { tokens: 10 } };
      const options = { userId: 'user123', sessionId: 'session456' };
      const mockAgentService = (facade as any).agentService;
      mockAgentService.execute.mockResolvedValue(mockResult);

      const result = await facade.execute('test-agent', 'Hello world', options);

      expect(mockAgentService.execute).toHaveBeenCalledWith('test-agent', 'Hello world', options);
      expect(result).toEqual(mockResult);
    });

    it('should handle agent service errors', async () => {
      const mockAgentService = (facade as any).agentService;
      mockAgentService.execute.mockRejectedValue(new Error('Agent execution failed'));

      await expect(facade.execute('test-agent', 'Hello world')).rejects.toThrow(
        'Agent execution failed'
      );
    });
  });

  describe('pipeline', () => {
    it('should create agent pipeline', async () => {
      const mockPipeline = {
        execute: jest.fn().mockResolvedValue({ response: 'Pipeline result' }),
      };
      const mockAgentService = {
        pipeline: jest.fn().mockReturnValue(mockPipeline),
      };

      // Manually set up the agent service for this test
      (facade as any).agentService = mockAgentService;
      (facade as any).resolved = true;

      const pipeline = facade.pipeline('test-pipeline', ['agent1', 'agent2']);

      expect(typeof pipeline.execute).toBe('function');

      const result = await pipeline.execute('Test input');
      expect(mockAgentService.pipeline).toHaveBeenCalledWith('test-pipeline', ['agent1', 'agent2']);
      expect(mockPipeline.execute).toHaveBeenCalledWith('Test input');
      expect(result).toEqual({ response: 'Pipeline result' });
    });

    it('should handle pipeline execution errors', async () => {
      const mockPipeline = {
        execute: jest.fn().mockRejectedValue(new Error('Pipeline execution failed')),
      };
      const mockAgentService = {
        pipeline: jest.fn().mockReturnValue(mockPipeline),
      };

      (facade as any).agentService = mockAgentService;
      (facade as any).resolved = true;

      const pipeline = facade.pipeline('test-pipeline', ['agent1']);

      await expect(pipeline.execute('Test input')).rejects.toThrow('Pipeline execution failed');
    });

    it('should handle pipeline creation errors', async () => {
      const mockAgentService = {
        pipeline: jest.fn().mockImplementation(() => {
          throw new Error('Pipeline creation failed');
        }),
      };

      (facade as any).agentService = mockAgentService;
      (facade as any).resolved = true;

      const pipeline = facade.pipeline('test-pipeline', ['agent1']);

      await expect(pipeline.execute('test input')).rejects.toThrow('Pipeline creation failed');
    });
  });

  describe('lazy loading behavior', () => {
    it('should not load agent service until first method call', async () => {
      expect((facade as any).resolved).toBe(false);

      // Don't call ensureAgent, just call a public method
      const { AgentService } = await import('@hazeljs/agent');

      await facade.execute('test', 'input');

      // Should have loaded after the first call
      expect((facade as any).resolved).toBe(true);
      expect(AgentService).toHaveBeenCalledTimes(1);
    });
  });
});
