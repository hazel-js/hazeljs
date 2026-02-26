import { ToolRegistry } from '../../src/registry/tool.registry';
import { Agent } from '../../src/decorators/agent.decorator';
import { Tool } from '../../src/decorators/tool.decorator';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('registerAgentTools', () => {
    it('should register tools from an agent instance', () => {
      @Agent({ name: 'test-agent', description: 'Test agent' })
      class TestAgent {
        @Tool({
          description: 'Test tool',
          parameters: [
            { name: 'input', type: 'string', required: true, description: 'Test input' },
          ],
        })
        async testTool(input: { input: string }) {
          return { result: input.input };
        }
      }

      const agent = new TestAgent();
      registry.registerAgentTools('test-agent', agent);

      expect(registry.count).toBe(1);
      expect(registry.hasTool('test-agent.testTool')).toBe(true);
    });

    it('should handle agents with no tools', () => {
      @Agent({ name: 'empty-agent', description: 'Empty agent' })
      class EmptyAgent {}

      const agent = new EmptyAgent();
      registry.registerAgentTools('empty-agent', agent);

      expect(registry.count).toBe(0);
    });

    it('should not register duplicate tools', () => {
      @Agent({ name: 'dup-agent', description: 'Duplicate agent' })
      class DupAgent {
        @Tool({ description: 'Dup tool', parameters: [] })
        async dupTool() {
          return { result: 'ok' };
        }
      }

      const agent = new DupAgent();
      registry.registerAgentTools('dup-agent', agent);
      registry.registerAgentTools('dup-agent', agent);

      expect(registry.count).toBe(1);
    });
  });

  describe('getTool', () => {
    it('should retrieve registered tool', () => {
      @Agent({ name: 'get-agent', description: 'Get agent' })
      class GetAgent {
        @Tool({ description: 'Get tool', parameters: [] })
        async getTool() {
          return { result: 'ok' };
        }
      }

      const agent = new GetAgent();
      registry.registerAgentTools('get-agent', agent);

      const tool = registry.getTool('get-agent.getTool');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('getTool');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = registry.getTool('non-existent');
      expect(tool).toBeUndefined();
    });
  });

  describe('getAgentTools', () => {
    it('should return all tools for an agent', () => {
      @Agent({ name: 'multi-agent', description: 'Multi agent' })
      class MultiAgent {
        @Tool({ description: 'Tool 1', parameters: [] })
        async tool1() {
          return { result: '1' };
        }

        @Tool({ description: 'Tool 2', parameters: [] })
        async tool2() {
          return { result: '2' };
        }
      }

      const agent = new MultiAgent();
      registry.registerAgentTools('multi-agent', agent);

      const tools = registry.getAgentTools('multi-agent');
      expect(tools).toHaveLength(2);
    });

    it('should return empty array for non-existent agent', () => {
      const tools = registry.getAgentTools('non-existent');
      expect(tools).toEqual([]);
    });
  });

  describe('getToolDefinitions', () => {
    it('should return empty array for non-existent agent', () => {
      const definitions = registry.getToolDefinitions('non-existent');
      expect(definitions).toEqual([]);
    });

    it('should include enum in parameters when specified', () => {
      @Agent({ name: 'enum-agent', description: 'Enum agent' })
      class EnumAgent {
        @Tool({
          description: 'Tool with enum',
          parameters: [
            {
              name: 'status',
              type: 'string',
              required: true,
              description: 'Status',
              enum: ['active', 'inactive'],
            },
          ],
        })
        async enumTool(input: { status: string }) {
          return { result: input.status };
        }
      }

      const agent = new EnumAgent();
      registry.registerAgentTools('enum-agent', agent);

      const definitions = registry.getToolDefinitions('enum-agent');
      expect(definitions).toHaveLength(1);
      expect(definitions[0].parameters.properties.status).toMatchObject({
        type: 'string',
        description: 'Status',
        enum: ['active', 'inactive'],
      });
    });

    it('should return tool definitions in correct format', () => {
      @Agent({ name: 'def-agent', description: 'Definition agent' })
      class DefAgent {
        @Tool({
          description: 'Test definition',
          parameters: [
            { name: 'param1', type: 'string', required: true, description: 'Param 1' },
            { name: 'param2', type: 'number', required: false, description: 'Param 2' },
          ],
        })
        async defTool(input: { param1: string; param2?: number }) {
          return { result: 'ok' };
        }
      }

      const agent = new DefAgent();
      registry.registerAgentTools('def-agent', agent);

      const definitions = registry.getToolDefinitions('def-agent');
      expect(definitions).toHaveLength(1);
      expect(definitions[0]).toMatchObject({
        name: 'defTool',
        description: 'Test definition',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'Param 1' },
            param2: { type: 'number', description: 'Param 2' },
          },
          required: ['param1'],
        },
      });
    });
  });

  describe('getToolDefinitionsForLLM', () => {
    it('should return LLM-formatted tool definitions', () => {
      @Agent({ name: 'llm-agent', description: 'LLM agent' })
      class LLMAgent {
        @Tool({
          description: 'LLM tool',
          parameters: [{ name: 'input', type: 'string', required: true, description: 'Input' }],
        })
        async llmTool(input: { input: string }) {
          return { result: 'ok' };
        }
      }

      const agent = new LLMAgent();
      registry.registerAgentTools('llm-agent', agent);

      const definitions = registry.getToolDefinitionsForLLM('llm-agent');
      expect(definitions).toHaveLength(1);
      expect(definitions[0]).toMatchObject({
        type: 'function',
        function: {
          name: 'llmTool',
          description: 'LLM tool',
          parameters: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Input' },
            },
            required: ['input'],
          },
        },
      });
    });
  });

  describe('unregisterAgentTools', () => {
    it('should remove all tools for an agent', () => {
      @Agent({ name: 'unreg-agent', description: 'Unregister agent' })
      class UnregAgent {
        @Tool({ description: 'Unreg tool', parameters: [] })
        async unregTool() {
          return { result: 'ok' };
        }
      }

      const agent = new UnregAgent();
      registry.registerAgentTools('unreg-agent', agent);
      expect(registry.count).toBe(1);

      registry.unregisterAgentTools('unreg-agent');
      expect(registry.count).toBe(0);
      expect(registry.hasTool('unreg-agent.unregTool')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all tools', () => {
      @Agent({ name: 'clear-agent', description: 'Clear agent' })
      class ClearAgent {
        @Tool({ description: 'Clear tool', parameters: [] })
        async clearTool() {
          return { result: 'ok' };
        }
      }

      const agent = new ClearAgent();
      registry.registerAgentTools('clear-agent', agent);
      expect(registry.count).toBe(1);

      registry.clear();
      expect(registry.count).toBe(0);
    });
  });
});
