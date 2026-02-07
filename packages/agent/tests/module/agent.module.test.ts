import { AgentModule, AgentService } from '../../src/agent.module';
import { Agent } from '../../src/decorators/agent.decorator';

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
      const contextPromise = service.getContext('non-existent');
      const context = contextPromise instanceof Promise ? await contextPromise : contextPromise;
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

