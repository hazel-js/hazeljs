import { AgentRegistry } from '../../src/registry/agent.registry';
import { Agent, getAgentMetadata, isAgent } from '../../src/decorators/agent.decorator';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('register', () => {
    it('should register an agent class', () => {
      @Agent({ name: 'test-agent', description: 'Test agent' })
      class TestAgent {}

      registry.register(TestAgent);

      expect(registry.hasAgent('test-agent')).toBe(true);
      expect(registry.count).toBe(1);
    });

    it('should throw error if class is not decorated with @Agent', () => {
      class NotAnAgent {}

      expect(() => registry.register(NotAnAgent as any)).toThrow(
        'is not decorated with @Agent'
      );
    });

    it('should throw error if agent is already registered', () => {
      @Agent({ name: 'duplicate-agent', description: 'Duplicate agent' })
      class DuplicateAgent {}

      registry.register(DuplicateAgent);

      expect(() => registry.register(DuplicateAgent)).toThrow(
        'Agent duplicate-agent is already registered'
      );
    });

    it('should throw error if metadata is missing', () => {
      // Create a mock class that passes isAgent but fails getAgentMetadata
      const MockAgent = class MockAgentClass {};
      
      // Mock the decorator functions
      const isAgentSpy = jest.spyOn(
        require('../../src/decorators/agent.decorator'),
        'isAgent'
      ).mockReturnValue(true);
      const getMetadataSpy = jest.spyOn(
        require('../../src/decorators/agent.decorator'),
        'getAgentMetadata'
      ).mockReturnValue(undefined);

      expect(() => registry.register(MockAgent as any)).toThrow(
        'Failed to get metadata'
      );

      isAgentSpy.mockRestore();
      getMetadataSpy.mockRestore();
    });
  });

  describe('registerInstance', () => {
    it('should register an agent instance', () => {
      @Agent({ name: 'instance-agent', description: 'Instance agent' })
      class InstanceAgent {}

      const instance = new InstanceAgent();
      registry.register(InstanceAgent);
      registry.registerInstance('instance-agent', instance);

      expect(registry.getInstance('instance-agent')).toBe(instance);
    });

    it('should throw error if agent is not registered', () => {
      const instance = {};

      expect(() => registry.registerInstance('non-existent', instance)).toThrow(
        'Agent non-existent is not registered'
      );
    });

    it('should update metadata with instance', () => {
      @Agent({ name: 'meta-agent', description: 'Meta agent' })
      class MetaAgent {}

      const instance = new MetaAgent();
      registry.register(MetaAgent);
      registry.registerInstance('meta-agent', instance);

      const agent = registry.getAgent('meta-agent');
      expect(agent?.instance).toBe(instance);
    });
  });

  describe('getAgent', () => {
    it('should return agent metadata', () => {
      @Agent({ name: 'get-agent', description: 'Get agent' })
      class GetAgent {}

      registry.register(GetAgent);
      const agent = registry.getAgent('get-agent');

      expect(agent).toBeDefined();
      expect(agent?.name).toBe('get-agent');
      expect(agent?.description).toBe('Get agent');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = registry.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('getInstance', () => {
    it('should return agent instance', () => {
      @Agent({ name: 'instance-get-agent', description: 'Instance get agent' })
      class InstanceGetAgent {}

      const instance = new InstanceGetAgent();
      registry.register(InstanceGetAgent);
      registry.registerInstance('instance-get-agent', instance);

      expect(registry.getInstance('instance-get-agent')).toBe(instance);
    });

    it('should return undefined for non-existent agent', () => {
      const instance = registry.getInstance('non-existent');
      expect(instance).toBeUndefined();
    });
  });

  describe('getAllAgents', () => {
    it('should return all registered agents', () => {
      @Agent({ name: 'agent1', description: 'Agent 1' })
      class Agent1 {}

      @Agent({ name: 'agent2', description: 'Agent 2' })
      class Agent2 {}

      registry.register(Agent1);
      registry.register(Agent2);

      const agents = registry.getAllAgents();
      expect(agents).toHaveLength(2);
      expect(agents.map((a) => a.name)).toContain('agent1');
      expect(agents.map((a) => a.name)).toContain('agent2');
    });

    it('should return empty array when no agents registered', () => {
      const agents = registry.getAllAgents();
      expect(agents).toEqual([]);
    });
  });

  describe('hasAgent', () => {
    it('should return true for registered agent', () => {
      @Agent({ name: 'has-agent', description: 'Has agent' })
      class HasAgent {}

      registry.register(HasAgent);
      expect(registry.hasAgent('has-agent')).toBe(true);
    });

    it('should return false for non-existent agent', () => {
      expect(registry.hasAgent('non-existent')).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should unregister an agent', () => {
      @Agent({ name: 'unreg-agent', description: 'Unregister agent' })
      class UnregAgent {}

      registry.register(UnregAgent);
      expect(registry.hasAgent('unreg-agent')).toBe(true);

      registry.unregister('unreg-agent');
      expect(registry.hasAgent('unreg-agent')).toBe(false);
      expect(registry.count).toBe(0);
    });

    it('should remove instance when unregistering', () => {
      @Agent({ name: 'unreg-instance-agent', description: 'Unregister instance agent' })
      class UnregInstanceAgent {}

      const instance = new UnregInstanceAgent();
      registry.register(UnregInstanceAgent);
      registry.registerInstance('unreg-instance-agent', instance);

      registry.unregister('unreg-instance-agent');

      expect(registry.getInstance('unreg-instance-agent')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all agents', () => {
      @Agent({ name: 'clear-agent1', description: 'Clear agent 1' })
      class ClearAgent1 {}

      @Agent({ name: 'clear-agent2', description: 'Clear agent 2' })
      class ClearAgent2 {}

      registry.register(ClearAgent1);
      registry.register(ClearAgent2);
      expect(registry.count).toBe(2);

      registry.clear();
      expect(registry.count).toBe(0);
      expect(registry.getAllAgents()).toEqual([]);
    });
  });

  describe('count', () => {
    it('should return correct count', () => {
      expect(registry.count).toBe(0);

      @Agent({ name: 'count-agent1', description: 'Count agent 1' })
      class CountAgent1 {}

      @Agent({ name: 'count-agent2', description: 'Count agent 2' })
      class CountAgent2 {}

      registry.register(CountAgent1);
      expect(registry.count).toBe(1);

      registry.register(CountAgent2);
      expect(registry.count).toBe(2);
    });
  });
});

