import { buildAgentCard, buildSingleAgentCard } from '../../src/a2a/agent-card.builder';
import type { AgentMetadata } from '../../src/types/agent.types';
import type { ToolMetadata } from '../../src/types/tool.types';

describe('A2A Agent Card Builder', () => {
    const dummyAgentMeta: AgentMetadata = {
        name: 'test-agent',
        description: 'A test agent',
        systemPrompt: 'You are a testing agent.',
        policies: ['test-policy'],
        target: class { } as any,
    };

    const dummyTool: ToolMetadata = {
        name: 'test-tool',
        description: 'A test tool',
        parameters: [],
        target: {},
        propertyKey: 'testTool',
        method: () => { },
    };

    const mockRuntime = {
        getAgents: jest.fn().mockReturnValue(['test-agent']),
        getAgentMetadata: jest.fn().mockReturnValue(dummyAgentMeta),
        getAgentTools: jest.fn().mockReturnValue([dummyTool]),
    };

    describe('buildAgentCard', () => {
        it('builds a full agent card with runtime', () => {
            const card = buildAgentCard(mockRuntime as any, {
                url: 'https://test.com',
                provider: { organization: 'Test Org' },
                version: '2.0.0',
            });

            expect(card.name).toBe('test-agent');
            expect(card.description).toBe('A test agent');
            expect(card.url).toBe('https://test.com');
            expect(card.provider?.organization).toBe('Test Org');
            expect(card.version).toBe('2.0.0');
            expect(card.skills).toHaveLength(1);

            const skill = card.skills[0];
            expect(skill.name).toBe('test-agent');
            expect(skill.description).toContain('Available tools:');
            expect(skill.description).toContain('test-tool');
            expect(skill.tags).toEqual(['test-policy']);
            expect(skill.examples).toEqual(['You are a testing agent.']);
        });

        it('handles empty runtime gracefully', () => {
            const emptyRuntime = {
                getAgents: () => [],
                getAgentMetadata: () => undefined,
                getAgentTools: () => [],
            };

            const card = buildAgentCard(emptyRuntime as any, { url: 'http://none.local' });
            expect(card.name).toBe('HazelJS Agent');
            expect(card.skills).toHaveLength(0);
        });

        it('builds description correctly without tools', () => {
            const emptyToolsRuntime = {
                getAgents: () => ['test-agent'],
                getAgentMetadata: () => dummyAgentMeta,
                getAgentTools: () => [],
            };

            const card = buildAgentCard(emptyToolsRuntime as any, { url: 'http://none.local' });
            expect(card.skills[0].description).toBe('A test agent');
        });

        it('builds description correctly without metadata description', () => {
            const noDescRuntime = {
                getAgents: () => ['nameless'],
                getAgentMetadata: () => undefined,
                getAgentTools: () => [],
            };

            const card = buildAgentCard(noDescRuntime as any, { url: 'http://none.local' });
            expect(card.skills[0].description).toBe('Agent: nameless');
        });
    });

    describe('buildSingleAgentCard', () => {
        it('builds an agent card directly from metadata', () => {
            const card = buildSingleAgentCard(dummyAgentMeta, [dummyTool], {
                url: 'https://single.com',
            });

            expect(card.name).toBe('test-agent');
            expect(card.url).toBe('https://single.com');
            expect(card.skills).toHaveLength(1);
            expect(card.skills[0].id).toBe('test-agent');
        });
    });
});
