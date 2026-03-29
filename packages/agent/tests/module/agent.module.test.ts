import { AgentModule, AgentService } from '../../src/agent.module';
import { Agent } from '../../src/decorators/agent.decorator';
import { Tool } from '../../src/decorators/tool.decorator';

describe('AgentModule', () => {
  describe('forRoot', () => {
    it('should return module class with default config', () => {
      const module = AgentModule.forRoot();

      expect(module).toBe(AgentModule);
      expect(AgentModule.getOptions()).toEqual({});
    });

    it('should store agents config if provided', () => {
      @Agent({ name: 'test-agent', description: 'Test agent' })
      class TestAgent {}

      const module = AgentModule.forRoot({
        agents: [TestAgent],
      });

      expect(module).toBe(AgentModule);
      expect(AgentModule.getOptions().agents).toContain(TestAgent);
    });

    it('should store custom runtime config', () => {
      const module = AgentModule.forRoot({
        runtime: {
          defaultMaxSteps: 20,
        },
      });

      expect(module).toBe(AgentModule);
      expect(AgentModule.getOptions().runtime?.defaultMaxSteps).toBe(20);
    });
  });

  describe('createLLMProviderFromAI', () => {
    let mockAIService: any;

    beforeEach(() => {
      mockAIService = {
        complete: jest.fn(),
        stream: jest.fn(),
      };
    });

    it('should handle chat without tools', async () => {
      mockAIService.complete.mockResolvedValue({
        content: 'Hello world',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });

      const provider = AgentModule.createLLMProviderFromAI(mockAIService);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.content).toBe('Hello world');
      expect(result.tool_calls).toBeUndefined();
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });

    it('should handle chat with tools and no tool results in history', async () => {
      mockAIService.complete.mockResolvedValue({
        content: 'Tool result',
        functionCall: { name: 'testTool', arguments: '{"input": "test"}' },
      });

      const provider = AgentModule.createLLMProviderFromAI(mockAIService);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Use tool' }],
        tools: [{
          type: 'function',
          function: { name: 'testTool', description: 'Test tool', parameters: {} },
        }],
      });

      expect(result.content).toBe('Tool result');
      expect(result.tool_calls).toEqual([{
        id: expect.stringMatching(/^call_\d+$/),
        type: 'function',
        function: { name: 'testTool', arguments: '{"input": "test"}' },
      }]);
    });

    it('should handle chat with new toolCalls format', async () => {
      mockAIService.complete.mockResolvedValue({
        content: 'Tool result',
        toolCalls: [{
          id: 'call_123',
          type: 'function',
          function: { name: 'newTool', arguments: '{"input": "new"}' },
        }],
      });

      const provider = AgentModule.createLLMProviderFromAI(mockAIService);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Use new tool' }],
        tools: [{
          type: 'function',
          function: { name: 'newTool', description: 'New tool', parameters: {} },
        }],
      });

      expect(result.tool_calls).toEqual([{
        id: 'call_123',
        type: 'function',
        function: { name: 'newTool', arguments: '{"input": "new"}' },
      }]);
    });

    it('should not pass tools when tool results exist in history', async () => {
      mockAIService.complete.mockResolvedValue({
        content: 'Final answer',
      });

      const provider = AgentModule.createLLMProviderFromAI(mockAIService);
      const result = await provider.chat({
        messages: [
          { role: 'user', content: 'Use tool' },
          { role: 'assistant', content: '[Tool: testTool] Tool result' },
          { role: 'user', content: 'Continue' },
        ],
        tools: [{
          type: 'function',
          function: { name: 'testTool', description: 'Test tool', parameters: {} },
        }],
      });

      // When tools are filtered out, functions and functionCall should not be present
      expect(mockAIService.complete).toHaveBeenCalledWith(
        expect.not.objectContaining({
          functions: expect.anything(),
          functionCall: expect.anything(),
        })
      );
      expect(result.content).toBe('Final answer');
    });

    it('should handle streaming chat', async () => {
      const mockChunks = [
        { content: 'Hello' },
        { content: ' world' },
        { done: true },
      ];
      const mockStream = jest.fn().mockImplementation(async function* () {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      });
      mockAIService.stream = mockStream;

      const provider = AgentModule.createLLMProviderFromAI(mockAIService);
      const chunks = [];
      for await (const chunk of provider.streamChat({
        messages: [{ role: 'user', content: 'Stream' }],
        tools: [],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(mockChunks);
    });

    it('should throw error when streaming is not supported', async () => {
      mockAIService.stream = undefined;

      const provider = AgentModule.createLLMProviderFromAI(mockAIService);

      try {
        for await (const chunk of provider.streamChat({
          messages: [{ role: 'user', content: 'Stream' }],
        })) {
          fail('Should have thrown an error');
        }
      } catch (error) {
        expect((error as Error).message).toBe('AIEnhancedService does not support streaming');
      }
    });

    it('should handle errors in chat', async () => {
      const error = new Error('AI service error');
      mockAIService.complete.mockRejectedValue(error);

      const provider = AgentModule.createLLMProviderFromAI(mockAIService);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(provider.chat({
        messages: [{ role: 'user', content: 'Error test' }],
      })).rejects.toThrow('AI service error');

      consoleSpy.mockRestore();
    });
  });
});

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    service = new AgentService();
  });

  describe('getRuntime', () => {
    it('should return runtime instance', () => {
      const runtime = service.getRuntime();
      expect(runtime).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute agent', async () => {
      // This will fail if agent is not registered, which is expected
      await expect(
        service.execute('non-existent', 'input', {})
      ).rejects.toThrow();
    });
  });

  describe('resume', () => {
    it('should resume execution', async () => {
      await expect(service.resume('non-existent')).rejects.toThrow();
    });
  });

  describe('getContext', () => {
    it('should get execution context', async () => {
      const context = await service.getContext('non-existent');
      expect(context).toBeUndefined();
    });
  });

  describe('on', () => {
    it('should subscribe to events', () => {
      const handler = jest.fn();
      service.on('agent.execution.started' as any, handler);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('getAgents', () => {
    it('should return registered agents', () => {
      const agents = service.getAgents();
      expect(Array.isArray(agents)).toBe(true);
    });
  });

  describe('approveToolExecution', () => {
    it('should approve tool execution', () => {
      expect(() => service.approveToolExecution('request-id', 'user-1')).not.toThrow();
    });
  });

  describe('rejectToolExecution', () => {
    it('should reject tool execution', () => {
      expect(() => service.rejectToolExecution('request-id')).not.toThrow();
    });
  });

  describe('getPendingApprovals', () => {
    it('should return pending approvals', () => {
      const approvals = service.getPendingApprovals();
      expect(Array.isArray(approvals)).toBe(true);
    });
  });
});

